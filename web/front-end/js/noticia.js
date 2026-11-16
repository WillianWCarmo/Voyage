// =============================================
// NOTICIA.JS - Carrega a notícia pelo ID
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('noticiaContent');
    const id = new URLSearchParams(window.location.search).get('id');
    if (!container) return;

    const createBackLink = () => {
        const link = document.createElement('a');
        link.href = 'blog.html';
        link.className = 'btn-voltar-noticia';
        const icon = document.createElement('i');
        icon.className = 'bi bi-arrow-left';
        link.append(icon, document.createTextNode(' Voltar ao Blog'));
        return link;
    };

    const showMessage = (message) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'noticia-container';
        const error = document.createElement('div');
        error.className = 'noticia-erro';
        const paragraph = document.createElement('p');
        paragraph.textContent = message;
        error.append(paragraph, createBackLink());
        wrapper.appendChild(error);
        container.replaceChildren(wrapper);
    };

    if (!id) {
        showMessage('Nenhuma notícia selecionada.');
        return;
    }

    const loading = document.createElement('div');
    loading.className = 'noticia-loading';
    loading.textContent = 'Carregando notícia...';
    container.replaceChildren(loading);

    try {
        const data = await window.voyageApi.getNews(id);

        const titleText = String(data.titulo || 'Notícia');
        document.title = `${titleText} | Voyage`;

        const wrapper = document.createElement('div');
        wrapper.className = 'noticia-container';

        const meta = document.createElement('div');
        meta.className = 'noticia-meta';
        const author = document.createElement('span');
        const authorIcon = document.createElement('i');
        authorIcon.className = 'bi bi-person';
        author.append(authorIcon, document.createTextNode(` ${data.autor || 'Equipe Voyage'}`));
        meta.appendChild(author);

        if (data.created_at) {
            const date = document.createElement('span');
            const dateIcon = document.createElement('i');
            dateIcon.className = 'bi bi-calendar3';
            const formatted = new Date(data.created_at);
            const dateText = Number.isNaN(formatted.getTime())
                ? ''
                : formatted.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            date.append(dateIcon, document.createTextNode(` ${dateText}`));
            if (dateText) meta.appendChild(date);
        }

        const title = document.createElement('h1');
        title.className = 'noticia-titulo';
        title.textContent = titleText;

        const image = document.createElement('img');
        image.className = 'noticia-imagem-principal';
        image.alt = titleText;
        image.addEventListener('error', () => {
            image.src = defaultNewsImage;
        }, { once: true });
        image.src = resolverImagemWeb(data.imagem_url);

        const body = document.createElement('div');
        body.className = 'noticia-corpo';
        appendSafeHtml(body, data.conteudo);

        wrapper.append(meta, title, image, body, createBackLink());
        container.replaceChildren(wrapper);
    } catch (err) {
        console.error('Erro ao carregar a notícia:', err);
        showMessage(err.message || 'Ocorreu um erro ao carregar a notícia.');
    }
});
