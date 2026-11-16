    const API_BASE = (window.VOYAGE_API_URL || `http://${window.location.hostname || 'localhost'}:3333/api`).replace(/\/+$/, '');

    let state = { news: [], partners: [], regions: [] };
    let modalMode = null; // { type: 'news'|'partners'|'regions', id: null|string }

    function getToken() {
      return localStorage.getItem('voyage_admin_token');
    }
    function getAdmin() {
      try { return JSON.parse(localStorage.getItem('voyage_admin_user') || 'null'); } catch { return null; }
    }
    function logout() {
      localStorage.removeItem('voyage_admin_token');
      localStorage.removeItem('voyage_admin_user');
      window.location.href = './admin.html';
    }
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.classList.remove('show'), 3200);
    }
    function escapeHtml(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function formatDate(v) {
      if (!v) return '—';
      try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
    }

    async function api(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (options.body) headers['Content-Type'] = 'application/json';
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      let res;
      try {
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      } catch {
        throw new Error('Não foi possível conectar à API. Verifique se o backend está rodando.');
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { logout(); throw new Error('Sessão expirada.'); }
      if (!res.ok) throw new Error(data.message || 'Erro na solicitação.');
      return data;
    }

    function switchSection(id) {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
      document.getElementById('section-' + id)?.classList.add('active');
      document.querySelector(`.sidebar-menu a[data-section="${id}"]`)?.classList.add('active');
    }

    // ----- RENDER -----
    function renderNews() {
      const tb = document.getElementById('tbodyNoticias');
      document.getElementById('statNoticias').textContent = state.news.length;
      if (!state.news.length) {
        tb.innerHTML = '<tr><td colspan="4" style="color:var(--admin-muted)">Nenhuma notícia.</td></tr>';
        return;
      }
      tb.innerHTML = state.news.map(n => `
        <tr>
          <td>${escapeHtml(n.title)}</td>
          <td>${escapeHtml(n.author)}</td>
          <td>${formatDate(n.published_at)}</td>
          <td class="actions">
            <button class="btn-icon btn-edit" data-edit-news="${escapeHtml(n.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon btn-delete" data-del-news="${escapeHtml(n.id)}" title="Remover"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`).join('');
    }

    function renderPartners() {
      const tb = document.getElementById('tbodyParceiros');
      document.getElementById('statParceiros').textContent = state.partners.length;
      if (!state.partners.length) {
        tb.innerHTML = '<tr><td colspan="4" style="color:var(--admin-muted)">Nenhum parceiro.</td></tr>';
        return;
      }
      tb.innerHTML = state.partners.map(p => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml((p.description || '').slice(0, 80))}</td>
          <td>${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" style="color:var(--admin-primary-text)">Abrir</a>` : '—'}</td>
          <td class="actions">
            <button class="btn-icon btn-edit" data-edit-partner="${escapeHtml(p.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon btn-delete" data-del-partner="${escapeHtml(p.id)}" title="Remover"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`).join('');
    }

    function renderRegions() {
      const tb = document.getElementById('tbodyRegioes');
      document.getElementById('statRegioes').textContent = state.regions.length;
      if (!state.regions.length) {
        tb.innerHTML = '<tr><td colspan="3" style="color:var(--admin-muted)">Nenhuma região.</td></tr>';
        return;
      }
      tb.innerHTML = state.regions.map(r => `
        <tr>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml((r.description || '').slice(0, 100))}</td>
          <td class="actions">
            <button class="btn-icon btn-edit" data-edit-region="${escapeHtml(r.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon btn-delete" data-del-region="${escapeHtml(r.id)}" title="Remover"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`).join('');
    }

    async function loadAll() {
      const [news, partners, regions] = await Promise.all([
        api('/admin/news'),
        api('/admin/partners'),
        api('/admin/regions')
      ]);
      state = { news, partners, regions };
      renderNews();
      renderPartners();
      renderRegions();
    }

    // ----- MODAL -----
    function openModal(type, item) {
      modalMode = { type, id: item?.id || null };
      const form = document.getElementById('modalForm');
      const title = document.getElementById('modalTitle');

      if (type === 'news') {
        title.textContent = item ? 'Editar notícia' : 'Nova notícia';
        form.innerHTML = `
          <div class="form-group"><label>Título *</label><input name="title" required value="${escapeHtml(item?.title || '')}"></div>
          <div class="form-group"><label>Autor</label><input name="author" value="${escapeHtml(item?.author || 'Equipe Voyage')}"></div>
          <div class="form-group"><label>Resumo</label><textarea name="summary">${escapeHtml(item?.summary || '')}</textarea></div>
          <div class="form-group"><label>Conteúdo</label><textarea name="content" style="min-height:140px">${escapeHtml(item?.content || '')}</textarea></div>
          <div class="form-group"><label>URL da imagem</label><input name="image" value="${escapeHtml(item?.image || '')}"></div>`;
      }
      if (type === 'partners') {
        title.textContent = item ? 'Editar parceiro' : 'Novo parceiro';
        form.innerHTML = `
          <div class="form-group"><label>Nome *</label><input name="name" required value="${escapeHtml(item?.name || '')}"></div>
          <div class="form-group"><label>Descrição</label><textarea name="description">${escapeHtml(item?.description || '')}</textarea></div>
          <div class="form-group"><label>URL do logo</label><input name="logo" value="${escapeHtml(item?.logo || '')}"></div>
          <div class="form-group"><label>Site</label><input name="url" value="${escapeHtml(item?.url || '')}"></div>`;
      }
      if (type === 'regions') {
        title.textContent = item ? 'Editar região' : 'Nova região';
        form.innerHTML = `
          <div class="form-group"><label>Nome *</label><input name="name" required value="${escapeHtml(item?.name || '')}"></div>
          <div class="form-group"><label>Descrição</label><textarea name="description">${escapeHtml(item?.description || '')}</textarea></div>
          <div class="form-group"><label>URL da imagem</label><input name="image" value="${escapeHtml(item?.image || '')}"></div>`;
      }
      document.getElementById('modalOverlay').classList.add('active');
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('active');
      modalMode = null;
    }

    async function saveModal() {
      if (!modalMode) return;
      const form = document.getElementById('modalForm');
      const data = Object.fromEntries(new FormData(form).entries());

      try {
        if (modalMode.type === 'news') {
          if (!data.title?.trim()) return showToast('Informe o título.');
          if (modalMode.id) {
            await api(`/admin/news/${encodeURIComponent(modalMode.id)}`, { method: 'PUT', body: JSON.stringify(data) });
          } else {
            await api('/admin/news', { method: 'POST', body: JSON.stringify(data) });
          }
        }
        if (modalMode.type === 'partners') {
          if (!data.name?.trim()) return showToast('Informe o nome.');
          if (modalMode.id) {
            await api(`/admin/partners/${encodeURIComponent(modalMode.id)}`, { method: 'PUT', body: JSON.stringify(data) });
          } else {
            await api('/admin/partners', { method: 'POST', body: JSON.stringify(data) });
          }
        }
        if (modalMode.type === 'regions') {
          if (!data.name?.trim()) return showToast('Informe o nome.');
          if (modalMode.id) {
            await api(`/admin/regions/${encodeURIComponent(modalMode.id)}`, { method: 'PUT', body: JSON.stringify(data) });
          } else {
            await api('/admin/regions', { method: 'POST', body: JSON.stringify(data) });
          }
        }
        closeModal();
        showToast('Salvo com sucesso.');
        await loadAll();
      } catch (err) {
        showToast(err.message);
      }
    }

    async function removeItem(type, id) {
      if (!confirm('Tem certeza que deseja remover este item?')) return;
      const paths = { news: '/admin/news/', partners: '/admin/partners/', regions: '/admin/regions/' };
      try {
        await api(paths[type] + encodeURIComponent(id), { method: 'DELETE' });
        showToast('Removido.');
        await loadAll();
      } catch (err) {
        showToast(err.message);
      }
    }

    // ----- EVENTS -----
    document.addEventListener('DOMContentLoaded', async () => {
      if (!getToken() || !getAdmin()) {
        window.location.href = './admin.html';
        return;
      }
      document.getElementById('adminName').textContent = getAdmin().name || getAdmin().email || 'Administrador';
      document.getElementById('btnLogout').addEventListener('click', logout);

      document.querySelectorAll('.sidebar-menu a[data-section]').forEach(a => {
        a.addEventListener('click', e => { e.preventDefault(); switchSection(a.dataset.section); });
      });

      document.getElementById('btnAddNews').addEventListener('click', () => openModal('news'));
      document.getElementById('btnAddPartner').addEventListener('click', () => openModal('partners'));
      document.getElementById('btnAddRegion').addEventListener('click', () => openModal('regions'));
      document.getElementById('modalCancel').addEventListener('click', closeModal);
      document.getElementById('modalSave').addEventListener('click', saveModal);
      document.getElementById('modalOverlay').addEventListener('click', e => {
        if (e.target.id === 'modalOverlay') closeModal();
      });

      document.body.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.editNews) {
          const item = state.news.find(n => n.id === btn.dataset.editNews);
          if (item) openModal('news', item);
        }
        if (btn.dataset.delNews) removeItem('news', btn.dataset.delNews);
        if (btn.dataset.editPartner) {
          const item = state.partners.find(p => p.id === btn.dataset.editPartner);
          if (item) openModal('partners', item);
        }
        if (btn.dataset.delPartner) removeItem('partners', btn.dataset.delPartner);
        if (btn.dataset.editRegion) {
          const item = state.regions.find(r => r.id === btn.dataset.editRegion);
          if (item) openModal('regions', item);
        }
        if (btn.dataset.delRegion) removeItem('regions', btn.dataset.delRegion);
      });

      try {
        await loadAll();
      } catch (err) {
        showToast(err.message);
      }
    });