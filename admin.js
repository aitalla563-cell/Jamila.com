here// admin.js
import {
    db, auth, doc, onSnapshot, updateDoc, setDoc, deleteDoc,
    signInWithEmailAndPassword, signOut, onAuthStateChanged,
    collection, query, orderBy
} from "./firebase.js";

const $ = (id) => document.getElementById(id);

const STATUS_CLASS = {
    'قيد الانتظار': 'status-pending',
    'مؤكد': 'status-confirmed',
    'تم الشحن': 'status-shipped',
    'تم التسليم': 'status-delivered',
    'ملغي': 'status-cancelled'
};

let allOrders = [];
let currentFilter = 'all';
let currentSearch = '';
let pendingDeleteId = null;

// ============ 1. إدارة حالة تسجيل الدخول ============
onAuthStateChanged(auth, (user) => {
    const loginScreen = $('login-screen');
    const adminDashboard = $('admin-dashboard');

    if (user) {
        loginScreen.style.display = 'none';
        adminDashboard.style.display = 'block';
        loadOrders();
        loadSettings();
    } else {
        loginScreen.style.display = 'flex';
        adminDashboard.style.display = 'none';
    }
});

$('toggle-pass')?.addEventListener('click', () => {
    const input = $('login-pass');
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    $('toggle-pass').innerText = isPass ? 'إخفاء' : 'إظهار';
});

$('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('login-email').value;
    const pass = $('login-pass').value;
    const errorBox = $('login-error');
    const submitBtn = $('login-submit');

    errorBox.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.innerText = 'جاري الدخول...';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        errorBox.innerText = 'البريد الإلكتروني أو كلمة السر غير صحيحة';
        errorBox.classList.add('visible');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'دخول';
    }
});

$('logout-btn')?.addEventListener('click', () => signOut(auth));

// ============ 2. تحميل الطلبات وتحديث الإحصائيات ============
function loadOrders() {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allOrders = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderStats(allOrders);
        renderOrders();
    }, (err) => {
        console.error('Orders Error:', err);
        showToast('تعذر تحميل الطلبات', 'error');
    });
}

function renderStats(orders) {
    let total = orders.length, pending = 0, delivered = 0, totalSales = 0;
    orders.forEach((data) => {
        if (data.status === 'قيد الانتظار') pending++;
        if (data.status === 'تم التسليم') {
            delivered++;
            totalSales += parseFloat(data.price) || 0;
        }
    });
    $('stat-total-orders').innerText = total;
    $('stat-pending-orders').innerText = pending;
    $('stat-delivered-orders').innerText = delivered;
    $('stat-total-sales').innerText = totalSales + ' د.م';
}

function renderOrders() {
    const tbody = $('orders-table-body');
    const emptyState = $('empty-state');
    if (!tbody) return;

    const filtered = allOrders.filter((data) => {
        const matchesStatus = currentFilter === 'all' || data.status === currentFilter;
        const haystack = `${data.name || ''} ${data.phone || ''} ${data.city || ''}`.toLowerCase();
        const matchesSearch = haystack.includes(currentSearch.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.hidden = false;
        $('empty-state-text').innerText = allOrders.length === 0
            ? 'لا توجد طلبات بعد — ستظهر هنا فور استلامها'
            : 'لا توجد نتائج مطابقة لبحثك';
        return;
    }
    emptyState.hidden = true;

    filtered.forEach((data) => {
        const id = data.id;
        const dateStr = data.createdAt
            ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'الآن';
        const cleanPhone = (data.phone || '').replace(/[^0-9]/g, '');
        const statusClass = STATUS_CLASS[data.status] || 'status-pending';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${escapeHtml(data.name)}</td>
            <td><a class="phone-link" href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener">${escapeHtml(data.phone)}</a></td>
            <td>${escapeHtml(data.city)}</td>
            <td>${escapeHtml(data.product)}</td>
            <td>
                <select class="status-select ${statusClass}" data-id="${id}">
                    ${Object.keys(STATUS_CLASS).map((s) => `<option value="${s}" ${data.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td>
                <button class="icon-btn" data-delete-id="${id}" aria-label="حذف الطلب">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.status-select').forEach((select) => {
        select.addEventListener('change', (e) => {
            const newStatus = e.target.value;
            e.target.className = `status-select ${STATUS_CLASS[newStatus] || 'status-pending'}`;
            updateOrderStatus(e.target.dataset.id, newStatus);
        });
    });

    tbody.querySelectorAll('[data-delete-id]').forEach((btn) => {
        btn.addEventListener('click', () => openConfirmDelete(btn.dataset.deleteId));
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function updateOrderStatus(id, status) {
    try {
        await updateDoc(doc(db, "orders", id), { status });
        showToast('تم تحديث حالة الطلب', 'success');
    } catch (err) {
        showToast('تعذر تحديث الحالة', 'error');
        console.error(err);
    }
}

// ============ 3. حذف الطلب عبر نافذة تأكيد ============
function openConfirmDelete(id) {
    pendingDeleteId = id;
    $('confirm-modal').classList.add('visible');
}

$('confirm-cancel')?.addEventListener('click', () => {
    pendingDeleteId = null;
    $('confirm-modal').classList.remove('visible');
});

$('confirm-delete')?.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
        await deleteDoc(doc(db, "orders", pendingDeleteId));
        showToast('تم حذف الطلب', 'success');
    } catch (err) {
        showToast('تعذر حذف الطلب', 'error');
        console.error(err);
    } finally {
        pendingDeleteId = null;
        $('confirm-modal').classList.remove('visible');
    }
});

// ============ 4. البحث والتصفية ============
$('search-input')?.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderOrders();
});

$('filter-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.status;
    renderOrders();
});

// ============ 5. تصدير CSV ============
$('export-csv-btn')?.addEventListener('click', () => {
    if (allOrders.length === 0) {
        showToast('لا توجد طلبات لتصديرها', 'error');
        return;
    }
    const headers = ['التاريخ', 'الاسم', 'الهاتف', 'المدينة', 'المنتج', 'السعر', 'الحالة'];
    const rows = allOrders.map((o) => [
        o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString('ar-MA') : '',
        o.name || '', o.phone || '', o.city || '', o.product || '', o.price || '', o.status || ''
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `طلبات-جميلتي-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
});

// ============ 6. إدارة الإعدادات والنافذة المنبثقة ============
const settingsModal = $('settings-modal');
$('open-settings-btn')?.addEventListener('click', () => settingsModal.classList.add('visible'));
$('close-settings')?.addEventListener('click', () => settingsModal.classList.remove('visible'));
$('cancel-settings')?.addEventListener('click', () => settingsModal.classList.remove('visible'));

function loadSettings() {
    onSnapshot(doc(db, "settings", "landing_page"), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        $('set-title').value = data.title || '';
        $('set-desc').value = data.desc || '';
        $('set-price').value = data.price || '';
        $('set-oldprice').value = data.oldPrice || '';
        $('set-whatsapp').value = data.whatsapp || '';
        $('set-pixels').value = data.pixels || '';
        if (Array.isArray(data.images)) {
            $('set-images-list').value = data.images.join('\n');
            renderImagePreviews(data.images);
        }
    });
}

function renderImagePreviews(images) {
    const wrap = $('image-preview-row');
    if (!wrap) return;
    wrap.innerHTML = '';
    images.slice(0, 8).forEach((url) => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.onerror = () => { img.style.display = 'none'; };
        wrap.appendChild(img);
    });
}

$('set-images-list')?.addEventListener('input', (e) => {
    const urls = e.target.value.split('\n').map((u) => u.trim()).filter(Boolean);
    renderImagePreviews(urls);
});

$('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = $('save-settings-btn');
    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const imagesArr = $('set-images-list').value.split('\n').map((url) => url.trim()).filter(Boolean);

    try {
        await setDoc(doc(db, "settings", "landing_page"), {
            title: $('set-title').value,
            desc: $('set-desc').value,
            price: $('set-price').value,
            oldPrice: $('set-oldprice').value,
            whatsapp: $('set-whatsapp').value,
            pixels: $('set-pixels').value,
            images: imagesArr
        }, { merge: true });

        showToast('تم حفظ الإعدادات بنجاح', 'success');
        settingsModal.classList.remove('visible');
    } catch (err) {
        showToast('تعذر حفظ الإعدادات', 'error');
        console.error(err);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ التغييرات';
    }
});

// ============ 7. نظام الإشعارات (Toasts) ============
function showToast(message, type = 'success') {
    const stack = $('toast-stack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    stack.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
        }
