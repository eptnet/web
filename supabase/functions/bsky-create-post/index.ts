import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { BskyAgent, AtpSessionEvent, AtpSessionData, RichText } from 'npm:@atproto/api'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Buffer } from "https://deno.land/std@0.170.0/node/buffer.ts";

const BSKY_SERVICE_URL = 'https://bsky.social'

async function getLinkPreview(url: string) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return null;
        const text = await response.text();
        const titleMatch = text.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
        const descriptionMatch = text.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
        const imageMatch = text.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
        return {
            title: titleMatch ? titleMatch[1] : 'Enlace externo',
            description: descriptionMatch ? descriptionMatch[1] : '',
            thumb: imageMatch ? imageMatch[1] : undefined,
        };
    } catch { return null; }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const authHeader = req.headers.get('Authorization')!;
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error("No autenticado")

        const { data: creds } = await supabaseAdmin.from('bsky_credentials').select('*').eq('user_id', user.id).single()
        if (!creds) throw new Error("Conecta tu cuenta de Bluesky primero")

        const { postText, postLink, base64Image, imageMimeType, linkTitle, linkDescription, linkThumb } = await req.json()

        const agent = new BskyAgent({
            service: BSKY_SERVICE_URL,
            async persistSession(evt: AtpSessionEvent, session?: AtpSessionData) {
                if (evt === 'update' && session) {
                    await supabaseAdmin.from('bsky_credentials').update({ 
                        access_jwt: session.accessJwt, 
                        refresh_jwt: session.refreshJwt 
                    }).eq('user_id', user.id)
                }
            },
        })

        await agent.resumeSession({ 
            accessJwt: creds.access_jwt, 
            refreshJwt: creds.refresh_jwt, 
            did: creds.did, 
            handle: creds.handle 
        });

        const rt = new RichText({ text: postText || "" });
        await rt.detectFacets(agent);

        let finalEmbed = undefined;
        let previewData = null;
        let uploadedThumbBlob = undefined;

        // MANEJO DE IMAGEN DIRECTA (Prioridad 1)
        if (base64Image) {
            const buffer = Buffer.from(base64Image, 'base64');
            if (buffer.length > 1000000) throw new Error("Imagen demasiado grande (>1MB)");
            const upload = await agent.uploadBlob(buffer, { encoding: imageMimeType });
            finalEmbed = { $type: 'app.bsky.embed.images', images: [{ image: upload.data.blob, alt: 'Post' }] };
        } 
        // MANEJO DE ENLACE EXTERNO (Prioridad 2)
        else if (postLink) {
            // Si el frontend envía los datos de la tarjeta, los usamos. Si no, intentamos extraerlos.
            previewData = (linkTitle || linkThumb) ? { 
                title: linkTitle, 
                description: linkDescription, 
                thumb: linkThumb 
            } : await getLinkPreview(postLink);

            if (previewData?.thumb) {
                try {
                    const imgRes = await fetch(previewData.thumb);
                    if (imgRes.ok) {
                        const imgBuffer = await imgRes.arrayBuffer();
                        if (imgBuffer.byteLength < 1000000) {
                            const upload = await agent.uploadBlob(new Uint8Array(imgBuffer), { 
                                encoding: imgRes.headers.get('content-type') || 'image/jpeg' 
                            });
                            uploadedThumbBlob = upload.data.blob;
                        } else {
                            console.warn("La imagen excede 1MB");
                        }
                    }
                } catch (e) { console.error("Error miniatura link:", e); }
            }
            finalEmbed = {
                $type: 'app.bsky.embed.external',
                external: { 
                    uri: postLink, 
                    title: previewData?.title || 'Enlace', 
                    description: previewData?.description || '', 
                    thumb: uploadedThumbBlob 
                }
            };
        }

        // PUBLICAR
        const published = await agent.post({
            text: rt.text, facets: rt.facets, embed: finalEmbed, createdAt: new Date().toISOString(), langs: ["es"]
        })

        // GUARDAR EN CACHE (Crucial para el feed)
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();

        await supabaseAdmin.from('community_feed_cache').insert([{
            uri: published.uri,
            cid: published.cid,
            author_did: creds.did,
            author_handle: creds.handle,
            author_display_name: profile?.display_name || creds.handle,
            author_avatar_url: profile?.avatar_url,
            post_text: postText,
            indexed_at: new Date().toISOString(),
            embed_external_uri: postLink || null,
            embed_external_title: previewData?.title || null,
            embed_external_description: previewData?.description || null,
            embed_external_thumb: previewData?.thumb || null // Guardamos la URL original para mostrarla en el feed
        }]);

        return new Response(JSON.stringify({ message: "Éxito" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 500 
        })
    }
})