// Filtro de regiões em tempo real, incluindo os itens carregados dinamicamente.
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const list = document.getElementById('cidadesList');
    if (!searchInput || !list) return;

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLocaleLowerCase('pt-BR').trim();
        list.querySelectorAll('.cidade-item').forEach((item) => {
            const cityName = (item.dataset.name || '').toLocaleLowerCase('pt-BR');
            item.classList.toggle('hidden', !cityName.includes(searchTerm));
        });
    });
});
