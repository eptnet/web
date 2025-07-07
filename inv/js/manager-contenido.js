export const ContentManager = {
    init() {
        this.addEventListeners();
        this.fetchOnDemandVideos();
        this.fetchShorts();
    },

    addEventListeners() {
        document.getElementById('add-ondemand-form').addEventListener('submit', e => this.handleAddContent(e, 'ondemand'));
        document.getElementById('add-short-form').addEventListener('submit', e => this.handleAddContent(e, 'short'));
        document.getElementById('ondemand-list-container').addEventListener('click', e => this.handleDeleteClick(e, 'ondemand'));
        document.getElementById('shorts-list-container').addEventListener('click', e => this.handleDeleteClick(e, 'short'));
    },

    async handleAddContent(e, type) {
        e.preventDefault();
        const form = e.target;
        const dataToInsert = { youtube_video_id: form.youtube_video_id.value };
        if (type === 'ondemand') dataToInsert.title = form.title.value;
        const tableName = type === 'ondemand' ? 'ondemand_videos' : 'shorts';

        const { error } = await App.supabase.from(tableName).insert(dataToInsert);
        if (error) {
            alert(`Error al añadir el ${type}.`);
        } else {
            form.reset();
            type === 'ondemand' ? this.fetchOnDemandVideos() : this.fetchShorts();
        }
    },

    async handleDeleteClick(e, type) {
        if (!e.target.matches('.delete-btn')) return;
        const id = e.target.dataset.id;
        const tableName = type === 'ondemand' ? 'ondemand_videos' : 'shorts';
        
        if (confirm(`¿Estás seguro de que quieres borrar este ${type}?`)) {
            const { error } = await App.supabase.from(tableName).delete().eq('id', id);
            if (error) alert(`Error al borrar el ${type}.`);
            else type === 'ondemand' ? this.fetchOnDemandVideos() : this.fetchShorts();
        }
    },

    async fetchOnDemandVideos() {
        const { data } = await App.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false });
        this.renderVideoList(data, 'ondemand-list-container');
    },

    async fetchShorts() {
        const { data } = await App.supabase.from('shorts').select('*').order('created_at', { ascending: false });
        this.renderVideoList(data, 'shorts-list-container');
    },

    renderVideoList(videos, containerId) {
        const container = document.getElementById(containerId);
        if (!videos || videos.length === 0) {
            container.innerHTML = '<p>No hay videos añadidos.</p>';
            return;
        }
        container.innerHTML = videos.map(video => `
            <div class="video-list-item">
                <img src="https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg" alt="miniatura">
                <span>${video.title || video.youtube_video_id}</span>
                <button class="delete-btn" data-id="${video.id}">&times;</button>
            </div>
        `).join('');
    }
};