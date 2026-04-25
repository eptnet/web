const EptCampus = {
    supabase: null,

    init() {
        // Escuchamos a tu main.js para usar la conexión global y evitar duplicados
        document.addEventListener('mainReady', async () => {
            console.log("campus.js: Sincronizando con la base de datos central...");
            
            // Usamos tu Key real para asegurarnos de que la consulta funcione
            const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
            
            // Intentamos usar el cliente global si existe, sino, creamos uno
            this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

            await this.renderCourses();
        });

        // Fallback: Por si mainReady se disparó antes de que este script cargara
        setTimeout(() => {
            if (!this.supabase) {
                const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
                const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
                this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                this.renderCourses();
            }
        }, 1500);
    },

    async renderCourses() {
        const container = document.getElementById('dynamic-courses-container');
        
        try {
            // Consultamos la tabla real
            const { data: courses, error } = await this.supabase
                .from('nooc_courses')
                .select('*')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!courses || courses.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: span 2; padding: 40px; text-align: center; border: 1px dashed rgba(255,255,255,0.2); border-radius: 16px;">
                        <i class="fa-solid fa-satellite-dish" style="font-size: 2rem; color: var(--color-edu-accent); margin-bottom: 10px;"></i>
                        <p style="opacity: 0.7;">No hay NOOCs publicados en la red. ¡Ve al editor y lanza el primero!</p>
                    </div>`;
                return;
            }

            container.innerHTML = courses.map(course => `
                <div class="edu-card nooc-thumb-card nooc-item" onclick="window.location.href='/edu/nooc.html?c=${course.slug}'" style="cursor:pointer;">
                    <img src="${course.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}" class="nooc-image" alt="${course.title}">
                    <div class="nooc-content">
                        <span style="font-size: 0.75rem; font-weight: 900; color: var(--color-edu-accent); text-transform: uppercase;">Módulo EPT</span>
                        <h4 class="nooc-title" style="margin: 8px 0 10px 0; font-size: 1.3rem;">${course.title}</h4>
                        <p class="nooc-desc" style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 20px; line-height: 1.4;">
                            Explora este nano-curso, supera los módulos y certifica tu conocimiento.
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.9rem; font-weight: bold; color: #f59e0b;"><i class="fa-solid fa-star"></i> Gamificado</span>
                            <button class="btn-action" style="width: auto; margin: 0; padding: 8px 15px; font-size: 0.8rem;">Entrar al Aula</button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error("Error crítico cargando los cursos:", err);
            container.innerHTML = '<p style="grid-column: span 2; color: #ef4444; text-align: center;">Error de conexión con la base de datos.</p>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => EptCampus.init());