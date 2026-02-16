const screens = Array.from(document.querySelectorAll('.screen'));
      const backBtn = document.getElementById('backBtn');
      const stack = ['screen-home'];
      let accessClosed = false;

      function showScreen(id) {
        const header = document.getElementById('appHeader');
        const locked = accessClosed && USER_ID !== ADMIN_ID;
        if (locked) id = 'screen-locked';
        screens.forEach(s => s.classList.remove('active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
        backBtn.classList.toggle('hidden', stack.length <= 1);
        if (header) header.classList.toggle('hidden', locked);
      }

      function pushScreen(id) {
        if (accessClosed && USER_ID !== ADMIN_ID) return showScreen('screen-locked');
        stack.push(id);
        showScreen(id);
      }

      function popScreen() {
        if (stack.length > 1) stack.pop();
        showScreen(stack[stack.length - 1]);
      }

      backBtn.addEventListener('click', popScreen);

      const tg = window.Telegram ? Telegram.WebApp : null;
      if (tg) tg.ready();

      const API_BASE = "https://api.112prd.ru:2053";
      const INIT_DATA = tg ? tg.initData : '';
      const ADMIN_ID = 312826672;
      function extractUserId() {
        try {
          if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) {
            return Number(tg.initDataUnsafe.user.id);
          }
          if (INIT_DATA) {
            const p = new URLSearchParams(INIT_DATA);
            const u = p.get('user');
            if (u) {
              const obj = JSON.parse(u);
              if (obj && obj.id) return Number(obj.id);
            }
          }
        } catch (e) {}
        return 0;
      }
      const USER_ID = extractUserId();

      function apiFetch(path, options = {}) {
        if (!API_BASE) return Promise.reject(new Error('no_api'));
        return fetch(API_BASE + path, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-InitData': INIT_DATA,
            ...(options.headers || {})
          }
        }).then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            const err = new Error(data.detail || 'api_error');
            err.status = r.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      }

      function setSubStatus(active) {
        const el = document.getElementById('subStatus');
        if (active) {
          el.textContent = 'ПОДПИСКА АКТИВНА';
          el.classList.remove('text-accent-red');
          el.classList.add('text-primary');
        } else {
          el.textContent = 'ПОДПИСКА НЕАКТИВНА';
          el.classList.remove('text-primary');
          el.classList.add('text-accent-red');
        }
      }

      let supportUrl = '';

      function loadUser() {
        if (!API_BASE || !INIT_DATA) return;
        apiFetch('/api/user')
          .then(data => {
            document.getElementById('balanceValue').textContent = (data.balance || 0) + '₽';
            document.getElementById('expiryValue').textContent = data.subscription.expiry || 'нет подписки';
            setSubStatus(data.subscription.active);
            document.getElementById('profileName').textContent = data.user.name || 'Пользователь';
            document.getElementById('profileId').textContent = 'ID: ' + data.user.id;
            document.getElementById('deviceLimit').textContent = data.device_limit || 3;
            document.getElementById('refLink').textContent = data.referral_link || 'нет ссылки';
            document.getElementById('discountValue').textContent = data.discount_text || ((data.discount || 0) + ' ₽');
            supportUrl = data.support_link || 'https://t.me/ghostlink112_bot';
            const supportLink = document.getElementById('supportLink');
            supportLink.href = supportUrl;
          })
          .catch((err) => {
            if (err && (err.status === 401 || err.status === 403)) {
              accessClosed = true;
              showScreen('screen-locked');
            }
          });
      }

      function notify(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => {
          el.classList.remove('show');
          setTimeout(() => el.remove(), 180);
        }, 1800);
      }

      function adminFetch(path, options = {}) {
        return apiFetch(path, options);
      }

      document.getElementById('buyBtn').addEventListener('click', () => pushScreen('screen-tariffs'));
      document.getElementById('profileBtn').addEventListener('click', () => pushScreen('screen-profile'));
      document.getElementById('supportBtn').addEventListener('click', () => pushScreen('screen-support'));

      document.getElementById('profilePayBtn').addEventListener('click', () => pushScreen('screen-tariffs'));
      document.getElementById('profileRefBtn').addEventListener('click', () => { pushScreen('screen-ref'); loadReferrals(); });
      document.getElementById('profileSupportBtn').addEventListener('click', () => pushScreen('screen-support'));
      document.getElementById('profileRulesBtn').addEventListener('click', () => pushScreen('screen-rules'));
      document.getElementById('profileDevicesBtn').addEventListener('click', () => pushScreen('screen-devices'));

      document.getElementById('copyRefBtn').addEventListener('click', async () => {
        const text = document.getElementById('refLink').textContent;
        try { await navigator.clipboard.writeText(text); } catch (e) {}
      });

      document.getElementById('supportLink').addEventListener('click', (e) => {
        if (!supportUrl) return;
        if (tg && tg.openTelegramLink) {
          e.preventDefault();
          tg.openTelegramLink(supportUrl);
        }
      });

      function loadReferrals() {
        apiFetch('/api/referrals')
          .then(data => {
            const box = document.getElementById('refList');
            if (!data.items || data.items.length === 0) {
              box.textContent = 'Пока никого нет.';
              box.className = 'text-muted-gray text-sm';
              return;
            }
            box.innerHTML = '';
            data.items.forEach(item => {
              const row = document.createElement('div');
              row.className = 'flex items-center justify-between py-2 border-b border-white/10 text-sm';
              const status = item.status === 'paid' ? 'Оплачено' : 'Ожидает оплаты';
              row.innerHTML = `<span>${item.name}</span><span class="text-muted-gray">${status}</span>`;
              box.appendChild(row);
            });
          })
          .catch(() => {});
      }

      document.getElementById('resetDeviceBtn').addEventListener('click', () => {
        apiFetch('/api/device/reset', { method: 'POST' }).catch(() => {});
        notify('Запрос на сброс отправлен.');
      });

      document.getElementById('soloPay').addEventListener('click', () => notify('Оплата будет подключена позже.'));
      document.getElementById('flexPay').addEventListener('click', () => notify('Оплата будет подключена позже.'));

      const flexPrices = { 2: 225, 3: 300, 4: 375, 5: 450 };
      const flexSlider = document.getElementById('flexSlider');
      flexSlider.addEventListener('input', () => {
        const v = parseInt(flexSlider.value, 10);
        document.getElementById('flexPrice').textContent = `${v} устройства — ${flexPrices[v]} ₽`;
      });

      if (USER_ID === ADMIN_ID) {
        const adminBtn = document.getElementById('homeAdminBtn');
        adminBtn.classList.remove('hidden');
        adminBtn.addEventListener('click', () => {
          pushScreen('screen-admin');
          loadAdminUsers();
        });
      }

      document.getElementById('adminStats').addEventListener('click', async () => {
        try {
          const data = await adminFetch('/api/admin/stats');
          notify('Статистика обновлена');
          const box = document.getElementById('adminStatsBox');
          box.textContent = `ОЗУ: ${data.free_mem_mb} MB | Онлайн: ${data.online.length} | Места: ${data.total}/${data.max_users}`;
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminOnline').addEventListener('click', async () => {
        try {
          const data = await adminFetch('/api/admin/stats');
          const list = data.online && data.online.length ? data.online.join(', ') : 'онлайн 0';
          notify(list);
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminRestart').addEventListener('click', async () => {
        try {
          await adminFetch('/api/admin/xray/restart', { method: 'POST' });
          notify('Xray перезапущен');
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminLock').addEventListener('click', async () => {
        try {
          const r = await adminFetch('/api/admin/panel/lock', { method: 'POST' });
          notify(r.message || 'Панель закрыта');
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminUnlock').addEventListener('click', async () => {
        const ip = document.getElementById('adminIp').value.trim();
        if (!ip) return notify('Укажи IP');
        try {
          const r = await adminFetch('/api/admin/panel/unlock', { method: 'POST', body: JSON.stringify({ ip }) });
          notify(r.message || 'Панель открыта');
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminIpShow').addEventListener('click', async () => {
        try {
          const r = await adminFetch('/api/admin/myip');
          notify(`Твой IP: ${r.ip || '-'}`);
          if (r.ip) document.getElementById('adminIp').value = r.ip;
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminAddSlots').addEventListener('click', async () => {
        try {
          const r = await adminFetch('/api/admin/add_slots', { method: 'POST' });
          notify(`Новый лимит: ${r.max_users}`);
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminBan').addEventListener('click', async () => {
        const userId = document.getElementById('adminUserId').value.trim();
        if (!userId) return notify('Укажи Telegram ID');
        try {
          await adminFetch('/api/admin/user/ban', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
          notify('Пользователь забанен');
          loadAdminUsers();
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminUnban').addEventListener('click', async () => {
        const userId = document.getElementById('adminUserId').value.trim();
        if (!userId) return notify('Укажи Telegram ID');
        try {
          await adminFetch('/api/admin/user/unban', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
          notify('Пользователь разблокирован');
          loadAdminUsers();
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminDelete').addEventListener('click', async () => {
        const userId = document.getElementById('adminUserId').value.trim();
        if (!userId) return notify('Укажи Telegram ID');
        try {
          await adminFetch('/api/admin/user/delete', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
          notify('Пользователь удален');
          loadAdminUsers();
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminUsersRefresh').addEventListener('click', loadAdminUsers);

      document.getElementById('adminClientCreate').addEventListener('click', async () => {
        const email = document.getElementById('adminClientEmail').value.trim();
        const tgId = document.getElementById('adminClientTgId').value.trim();
        const limit = parseInt(document.getElementById('adminClientLimit').value || '3', 10);
        if (!email) return notify('Укажи название/email клиента');
        try {
          await adminFetch('/api/admin/client/create', {
            method: 'POST',
            body: JSON.stringify({ email: email, tg_id: tgId || 'manual', limit: limit })
          });
          notify('Клиент добавлен');
          document.getElementById('adminClientEmail').value = '';
          loadAdminClients();
        } catch (e) {
          notify('Ошибка');
        }
      });
      document.getElementById('adminBackup').addEventListener('click', async () => {
        try {
          const resp = await fetch(API_BASE + '/api/admin/backup', {
            headers: { 'X-Telegram-InitData': INIT_DATA }
          });
          if (!resp.ok) throw new Error('backup_error');
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'ghostlink-backup.db';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          notify('Бэкап скачан');
        } catch (e) {
          notify('Ошибка');
        }
      });

      function formatBytes(val) {
        const v = Number(val || 0);
        if (v < 1024) return v + ' B';
        const kb = v / 1024;
        if (kb < 1024) return kb.toFixed(1) + ' KB';
        const mb = kb / 1024;
        if (mb < 1024) return mb.toFixed(1) + ' MB';
        const gb = mb / 1024;
        return gb.toFixed(2) + ' GB';
      }

      async function loadAdminClients() {
        const box = document.getElementById('adminClients');
        box.textContent = 'Загрузка...';
        try {
          const data = await adminFetch('/api/admin/clients');
          if (!data.items || data.items.length === 0) {
            box.textContent = 'Список пуст';
            return;
          }
          box.innerHTML = '';
          data.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-2 py-2 border-b border-white/10';
            const left = document.createElement('div');
            left.className = 'flex flex-col';
            const name = document.createElement('div');
            name.className = 'text-white';
            name.textContent = item.email || item.uuid;
            const meta = document.createElement('div');
            meta.className = 'text-muted-gray text-xs';
            meta.textContent = `${item.online ? 'Онлайн' : 'Офлайн'} · ${formatBytes(item.total || 0)}`;
            left.appendChild(name);
            left.appendChild(meta);

            const right = document.createElement('div');
            right.className = 'flex gap-2';
            const toggle = document.createElement('button');
            toggle.className = 'ios-active border border-primary text-primary font-bold px-2 py-1 rounded-lg text-xs';
            toggle.textContent = item.enable ? 'Откл' : 'Вкл';
            toggle.addEventListener('click', async () => {
              try {
                await adminFetch('/api/admin/client/enable', {
                  method: 'POST',
                  body: JSON.stringify({ uuid: item.uuid, enable: !item.enable })
                });
                notify('Сохранено');
                loadAdminClients();
              } catch (e) {
                notify('Ошибка');
              }
            });
            const del = document.createElement('button');
            del.className = 'ios-active border border-primary text-primary font-bold px-2 py-1 rounded-lg text-xs';
            del.textContent = 'Удалить';
            del.addEventListener('click', async () => {
              try {
                await adminFetch('/api/admin/client/delete', {
                  method: 'POST',
                  body: JSON.stringify({ uuid: item.uuid })
                });
                notify('Удалено');
                loadAdminClients();
              } catch (e) {
                notify('Ошибка');
              }
            });
            right.appendChild(toggle);
            right.appendChild(del);

            row.appendChild(left);
            row.appendChild(right);
            box.appendChild(row);
          });
        } catch (e) {
          box.textContent = 'Ошибка загрузки';
        }
      }

      document.getElementById('adminClientsRefresh').addEventListener('click', loadAdminClients);

      async function loadAdminUsers() {
        const sel = document.getElementById('adminUserId');
        if (!sel) return;
        try {
          const data = await adminFetch('/api/admin/users');
          sel.innerHTML = '<option value="">Выбери пользователя</option>';
          (data.items || []).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.name} (${u.id}) [${u.status}]`;
            sel.appendChild(opt);
          });
          notify('Список пользователей обновлен');
        } catch (e) {
          notify('Ошибка загрузки пользователей');
        }
      }

      loadUser();
