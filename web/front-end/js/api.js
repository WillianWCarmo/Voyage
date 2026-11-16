// =============================================
// API.JS - Funções compartilhadas do Voyage
// =============================================

const webImagesDirectory = new URL('../img/', document.currentScript.src);
const defaultNewsImage = new URL('noticia_1.png', webImagesDirectory).href;

function resolverImagemWeb(imagePath) {
    const path = typeof imagePath === 'string' ? imagePath.trim() : '';
    if (!path) return defaultNewsImage;

    // URLs externas só são aceitas em HTTP(S); esquemas executáveis/data são recusados.
    if (/^(https?:)?\/\//i.test(path)) {
        try {
            const url = new URL(path, document.baseURI);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : defaultNewsImage;
        } catch {
            return defaultNewsImage;
        }
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return defaultNewsImage;

    const normalizedPath = path.replace(/\\/g, '/');
    const localImageMatch = normalizedPath.match(/(?:^|\/)(?:front-end\/)?img\/(.+)$/i);
    if (localImageMatch) return new URL(localImageMatch[1], webImagesDirectory).href;
    if (!normalizedPath.includes('/')) return new URL(normalizedPath, webImagesDirectory).href;

    try {
        const url = new URL(normalizedPath, document.baseURI);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : defaultNewsImage;
    } catch {
        return defaultNewsImage;
    }
}

function resolverLinkWeb(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value.trim(), document.baseURI);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

// Renderiza conteúdo editorial preservando formatação básica, sem executar
// scripts, atributos de evento, estilos ou URLs com esquemas perigosos.
function appendSafeHtml(container, html) {
    const parsed = new DOMParser().parseFromString(
        typeof html === 'string' ? html : '',
        'text/html'
    );
    const allowedTags = new Set([
        'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U',
        'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE', 'A'
    ]);

    const copyNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.nodeValue || '');
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();

        const source = node;
        if (!allowedTags.has(source.tagName)) {
            const fragment = document.createDocumentFragment();
            source.childNodes.forEach((child) => fragment.appendChild(copyNode(child)));
            return fragment;
        }

        const target = document.createElement(source.tagName.toLowerCase());
        if (source.tagName === 'A') {
            const href = resolverLinkWeb(source.getAttribute('href'));
            if (href) {
                target.href = href;
                target.rel = 'noopener noreferrer';
                target.target = '_blank';
            }
        }
        source.childNodes.forEach((child) => target.appendChild(copyNode(child)));
        return target;
    };

    const fragment = document.createDocumentFragment();
    parsed.body.childNodes.forEach((child) => fragment.appendChild(copyNode(child)));
    container.replaceChildren(fragment);
}

function extrairTextoWeb(html) {
    const parsed = new DOMParser().parseFromString(
        typeof html === 'string' ? html : '',
        'text/html'
    );
    return parsed.body.textContent || '';
}

// Cliente HTTP compartilhado do Web. O navegador nunca acessa o PostgreSQL diretamente.
const VOYAGE_API_BASE = (window.VOYAGE_API_URL || `http://${window.location.hostname || 'localhost'}:13022/api`).replace(/\/+$/, '');
console.log( VOYAGE_API_BASE)
async function requisicaoVoyage(path, options = {}) {
    let response;
    try {
        response = await fetch(`${VOYAGE_API_BASE}${path}`, {
            ...options,
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {})
            }
        });
    } catch (error) {
        throw new Error(`Não foi possível conectar à API local (${VOYAGE_API_BASE}). Verifique se o backend está em execução.`);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Não foi possível concluir a solicitação.');
    return payload;
}

async function buscarNoticias() {
    return requisicaoVoyage('/public/news');
}

async function buscarParceiros() {
    return requisicaoVoyage('/public/partners');
}

async function buscarRegioes() {
    return requisicaoVoyage('/public/regions');
}

window.voyageApi = {
    baseUrl: VOYAGE_API_BASE,
    request: requisicaoVoyage,
    getNews: (id) => requisicaoVoyage(`/public/news/${encodeURIComponent(id)}`),
    getNewsList: buscarNoticias,
    getPartners: buscarParceiros,
    getRegions: buscarRegioes
};
