// =============================================
// REGIOES.JS — lista de regiões + filtro + foto
// =============================================

function escapeHtmlRegiao(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function carregarRegioes() {
    const lista = document.getElementById('cidadesList');
    if (!lista) return;

    try {
        const regioes = await buscarRegioes();

        if (!regioes.length) {
            const empty = document.createElement('p');
            empty.className = 'regioes-empty-state';
            empty.textContent = 'Nenhuma região cadastrada.';
            lista.replaceChildren(empty);
            return;
        }

        const fragment = document.createDocumentFragment();

        regioes.forEach((regiao) => {
            const item = document.createElement('div');
            item.className = 'cidade-item';
            item.dataset.name = String(regiao.nome || '').toLocaleLowerCase('pt-BR');

            const info = document.createElement('div');
            info.className = 'cidade-info';

            // Foto em quadrado pequeno, ou ícone se não houver imagem
            const imageUrl = regiao.imagem_url || regiao.image || '';
            if (imageUrl) {
                const foto = document.createElement('img');
                foto.className = 'cidade-foto';
                foto.alt = regiao.nome || 'Cidade';
                foto.loading = 'lazy';
                foto.src = typeof resolverImagemWeb === 'function'
                    ? resolverImagemWeb(imageUrl)
                    : imageUrl;
                foto.addEventListener('error', () => {
                    const icon = document.createElement('div');
                    icon.className = 'cidade-icon';
                    const iconElement = document.createElement('i');
                    iconElement.className = 'bi bi-geo-alt-fill';
                    icon.appendChild(iconElement);
                    foto.replaceWith(icon);
                }, { once: true });
                info.appendChild(foto);
            } else {
                const icon = document.createElement('div');
                icon.className = 'cidade-icon';
                const iconElement = document.createElement('i');
                iconElement.className = 'bi bi-geo-alt-fill';
                icon.appendChild(iconElement);
                info.appendChild(icon);
            }

            const details = document.createElement('div');
            const title = document.createElement('h3');
            title.textContent = regiao.nome || 'Região';

            const status = document.createElement('p');
            status.className = 'cidade-status';
            const dot = document.createElement('span');
            dot.className = 'status-dot';
            status.append(dot, document.createTextNode(' Em operação'));

            details.append(title, status);
            info.appendChild(details);
            item.appendChild(info);
            fragment.appendChild(item);
        });

        lista.replaceChildren(fragment);

        // Reaplica o filtro se já houver texto na busca
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const term = searchInput.value.toLocaleLowerCase('pt-BR').trim();
            lista.querySelectorAll('.cidade-item').forEach((item) => {
                const cityName = (item.dataset.name || '');
                item.classList.toggle('hidden', term !== '' && !cityName.includes(term));
            });
        }
    } catch (error) {
        console.error('Não foi possível carregar as regiões:', error);
        const message = document.createElement('p');
        message.textContent = 'Não foi possível carregar as regiões. Tente novamente mais tarde.';
        lista.replaceChildren(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Filtro de busca
    const searchInput = document.getElementById('searchInput');
    const list = document.getElementById('cidadesList');

    if (searchInput && list) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLocaleLowerCase('pt-BR').trim();
            list.querySelectorAll('.cidade-item').forEach((item) => {
                const cityName = (item.dataset.name || '').toLocaleLowerCase('pt-BR');
                item.classList.toggle('hidden', searchTerm !== '' && !cityName.includes(searchTerm));
            });
        });
    }

    // Carrega as regiões da API
    carregarRegioes();
});