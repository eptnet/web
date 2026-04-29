const CourseAnalytics = {
    supabase: null,
    course: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/edu/'; return; }

        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('c');
        if (!slug) { window.location.href = '/edu/'; return; }

        await this.loadData(slug, session.user.id);
    },

    async loadData(slug, userId) {
        try {
            // 1. Cargar datos del curso y sus lecciones para calcular el total
            const { data: course, error } = await this.supabase
                .from('nooc_courses')
                .select(`*, nooc_modules(id, nooc_lessons(id))`)
                .eq('slug', slug)
                .single();

            if (error) throw error;

            // 2. Verificar que el usuario sea el dueño
            if (course.created_by !== userId) {
                alert("Acceso denegado: No eres el creador de este curso.");
                window.location.href = '/edu/';
                return;
            }
            this.course = course;

            // Renderizamos la info básica
            document.getElementById('course-title').textContent = course.title;
            document.getElementById('btn-edit-course').onclick = () => {
                sessionStorage.setItem('activeCourse', JSON.stringify(course));
                window.location.href = '/edu/nooc-editor.html';
            };
            if(course.bsky_uri) {
                const rkey = course.bsky_uri.split('/').pop();
                document.getElementById('link-course-forum').href = `https://bsky.app/profile/cursos.epistecnologia.com/post/${rkey}`;
            }

            // Calculamos el total de lecciones del curso
            let totalLessons = 0;
            const lessonIds = [];
            course.nooc_modules.forEach(m => {
                totalLessons += m.nooc_lessons.length;
                m.nooc_lessons.forEach(l => lessonIds.push(l.id));
            });

            // 3. Cargar Alumnos Matriculados con sus perfiles
            const { data: enrollments } = await this.supabase
                .from('nooc_enrollments')
                .select(`created_at, user_id, profiles(display_name, username, avatar_url, orcid)`)
                .eq('course_id', course.id);

            document.getElementById('stat-students').textContent = enrollments ? enrollments.length : 0;

            // 4. Obtener todo el progreso de todos los alumnos en estas lecciones
            const { data: progressData } = await this.supabase
                .from('nooc_progress')
                .select('user_id, lesson_id')
                .in('lesson_id', lessonIds);

            // 5. Cargar Handles de Bluesky
            const { data: bskyData } = await this.supabase.from('bsky_credentials').select('user_id, handle');

            this.renderStudentTable(enrollments, progressData, bskyData, totalLessons);

        } catch (err) {
            console.error(err);
            document.getElementById('course-title').textContent = "Error al cargar datos";
        }
    },

    renderStudentTable(enrollments, progressData, bskyData, totalLessons) {
        const tbody = document.getElementById('students-tbody');
        
        if (!enrollments || enrollments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; opacity:0.5;">Aún no hay alumnos matriculados.</td></tr>`;
            return;
        }

        let totalProgressSum = 0;
        let html = '';

        enrollments.forEach(enroll => {
            const profile = enroll.profiles;
            const bsky = bskyData?.find(b => b.user_id === enroll.user_id);
            const handleText = bsky ? `@${bsky.handle}` : 'No vinculado';
            
            // Calculamos el progreso de ESTE usuario
            const userProgressCount = progressData ? progressData.filter(p => p.user_id === enroll.user_id).length : 0;
            const progressPercent = totalLessons > 0 ? Math.round((userProgressCount / totalLessons) * 100) : 0;
            totalProgressSum += progressPercent;

            const date = new Date(enroll.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

            html += `
                <tr class="student-row">
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${profile?.avatar_url || 'https://api.dicebear.com/9.x/shapes/svg?seed='+enroll.user_id}" style="width:30px; height:30px; border-radius:50%;">
                            <strong>${profile?.display_name || profile?.username || 'Estudiante'}</strong>
                        </div>
                    </td>
                    <td style="font-size: 0.85rem;">
                        <div style="color: #38bdf8;">${handleText}</div>
                        ${profile?.orcid ? `<div style="color: #a6ce39; margin-top:2px;">ORCID: ${profile.orcid}</div>` : ''}
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progressPercent}%;"></div></div>
                            <span style="font-size:0.85rem; font-weight:bold;">${progressPercent}%</span>
                        </div>
                    </td>
                    <td style="font-size: 0.85rem; color: #a0aab5;">${date}</td>
                    <td>
                        ${bsky ? `<a href="https://bsky.app/profile/${bsky.handle}" target="_blank" class="btn-edit" style="background:transparent; border:1px solid #38bdf8; color:#38bdf8; padding: 4px 10px; font-size: 0.75rem;"><i class="fa-solid fa-paper-plane"></i> Contactar</a>` : '-'}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Promedio del curso
        const avgProgress = enrollments.length > 0 ? Math.round(totalProgressSum / enrollments.length) : 0;
        document.getElementById('stat-progress').textContent = `${avgProgress}%`;
    }
};

document.addEventListener('DOMContentLoaded', () => CourseAnalytics.init());