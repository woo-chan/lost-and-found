// ─── 🔗 우찬 님의 실제 파이어베이스 콘솔 설정값 연동 ───
const firebaseConfig = {
    apiKey: "AIzaSyCOip7CfjiSGQC3Zz7_qDKCmXlev0GKPRk",
    authDomain: "lost-and-found-ab11b.firebaseapp.com",
    databaseURL: "https://lost-and-found-ab11b-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "lost-and-found-ab11b",
    storageBucket: "lost-and-found-ab11b.firebasestorage.app",
    messagingSenderId: "715679492378",
    appId: "1:715679492378:web:070891f2b5efa9d73c64a3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let lostItems = [];
let currentUser = null; 
let currentView = 'grid'; 
let currentCategory = 'all'; 
let currentPage = 1;      
const itemsPerPage = 15;  

const modal = document.getElementById('lost-item-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const lostItemForm = document.getElementById('lost-item-form');
const itemListContainer = document.getElementById('item-list');

const paginationTop = document.getElementById('pagination-top');
const paginationBottom = document.getElementById('pagination-bottom');

const filterButtons = document.querySelectorAll('.category-buttons .btn');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');

const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loggedOutArea = document.getElementById('logged-out-area');
const loggedInArea = document.getElementById('logged-in-area');
const userInfoSpan = document.getElementById('user-info');

const itemImagesInput = document.getElementById('item-images');
const fileCountPreview = document.getElementById('file-count-preview');
const customFileTrigger = document.getElementById('custom-file-trigger');

const categoryMap = {
    wallet: '지갑 · 카드',
    electronics: '전자기기',
    jewelry: '액세서리',
    cosmetics: '화장품',
    others: '기타'
};

function compressAndConvertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
                resolve(compressedBase64);
            };
        };
        reader.onerror = error => reject(error);
    });
}

customFileTrigger.addEventListener('click', () => {
    itemImagesInput.click();
});

itemImagesInput.addEventListener('change', () => {
    const files = itemImagesInput.files;
    if (files.length > 0) {
        fileCountPreview.innerText = `📸 선택된 사진: ${files.length}개`;
        customFileTrigger.style.color = '#334155';
        customFileTrigger.style.borderColor = '#3b82f6';
    } else {
        fileCountPreview.innerText = '예: 사진 업로드 (클릭하여 선택)';
        customFileTrigger.style.color = '#94a3b8';
        customFileTrigger.style.borderColor = '#cbd5e1';
    }
});

googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(() => alert("구글 로그인에 성공했습니다!"))
        .catch(err => alert("로그인 실패: " + err.message));
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => alert("로그아웃 되었습니다."));
});

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        userInfoSpan.innerText = `${user.displayName}님`; 
        loggedOutArea.style.display = "none";
        loggedInArea.style.display = "flex"; 
    } else {
        currentUser = null;
        userInfoSpan.innerText = "";
        loggedOutArea.style.display = "block";
        loggedInArea.style.display = "none";  
    }
    renderItems(); 
});

db.collection("lostItems").orderBy("timestamp", "asc").onSnapshot((snapshot) => {
    lostItems = [];
    snapshot.forEach((doc) => {
        lostItems.push({ id: doc.id, ...doc.data() });
    });
    renderItems();
});

openModalBtn.addEventListener('click', () => {
    modal.style.display = 'block';
    setTimeout(() => { modal.classList.add('show'); }, 10);
});

function closeSidePage() {
    lostItemForm.reset();
    fileCountPreview.innerText = '예: 사진 업로드 (클릭하여 선택)';
    customFileTrigger.style.color = '#94a3b8';
    customFileTrigger.style.borderColor = '#cbd5e1';
    
    const submitBtn = lostItemForm.querySelector('.submit-btn');
    submitBtn.innerText = "등록하기";
    submitBtn.disabled = false;

    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}
closeModalBtn.addEventListener('click', closeSidePage);

viewGridBtn.addEventListener('click', () => {
    currentView = 'grid';
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    renderItems();
});
viewListBtn.addEventListener('click', () => {
    currentView = 'list';
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    renderItems();
});

lostItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("로그인이 필요한 작업입니다.");

    const category = document.getElementById('item-category').value;
    const name = document.getElementById('item-name').value;
    const location = document.getElementById('item-location').value;
    const imageFiles = itemImagesInput.files;

    if (imageFiles.length === 0 || imageFiles.length > 3) {
        return alert('사진은 최소 1장부터 최대 3장까지 등록할 수 있습니다.');
    }

    const submitBtn = lostItemForm.querySelector('.submit-btn');
    submitBtn.innerText = "이미지 압축 및 등록 중...";
    submitBtn.disabled = true;

    try {
        const imageUrls = [];
        for (let i = 0; i < imageFiles.length; i++) {
            const base64Str = await compressAndConvertToBase64(imageFiles[i]);
            imageUrls.push(base64Str);
        }

        await db.collection("lostItems").add({
            category: category,
            name: name,
            location: location,
            imageUrls: imageUrls, 
            status: 'active',
            date: new Date().toLocaleDateString('ko-KR'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            authorUid: currentUser.uid,
            authorEmail: currentUser.email
        });

        // [수정] 탭이 시각적으로 먼저 자동으로 닫히도록 조치 후 알림을 띄웁니다.
        closeSidePage();
        setTimeout(() => {
            alert('서버에 분실물이 안전하게 기록되었습니다!');
        }, 350);

    } catch (err) {
        alert("등록 실패: " + err.message);
        submitBtn.innerText = "등록하기";
        submitBtn.disabled = false;
    }
});

function deleteItem(id) {
    if (!currentUser) return alert("로그인이 필요합니다.");
    
    if (confirm("정말 이 분실물 게시글을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.")) {
        db.collection("lostItems").doc(id).delete()
            .then(() => alert("서버에서 안전하게 삭제되었습니다."))
            .catch(err => alert("삭제 실패: " + err.message));
    }
}

function openImageLightbox(id) {
    const item = lostItems.find(item => item.id === id);
    if (!item || !item.imageUrls || item.imageUrls.length === 0) return;

    const lightbox = document.getElementById('image-lightbox-modal');
    const container = document.getElementById('lightbox-images-container');
    container.innerHTML = ''; 

    item.imageUrls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'lightbox-img';
        container.appendChild(img);
    });

    lightbox.style.display = 'block';
    setTimeout(() => lightbox.classList.add('show'), 10);
}

function closeImageLightbox() {
    const lightbox = document.getElementById('image-lightbox-modal');
    lightbox.classList.remove('show');
    setTimeout(() => lightbox.style.display = 'none', 300);
}

window.deleteItem = deleteItem;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;

function renderItems() {
    itemListContainer.className = `item-list ${currentView}`;
    itemListContainer.innerHTML = '';

    const totalCount = lostItems.length;
    const claimedCount = lostItems.filter(item => item.status === 'claimed').length;
    document.getElementById('count-total').innerText = `전체 ${totalCount}`;
    document.getElementById('count-claimed').innerText = `완료 ${claimedCount}`;

    const filteredItems = currentCategory === 'all' 
        ? lostItems 
        : lostItems.filter(item => item.category === currentCategory);

    if (filteredItems.length === 0) {
        itemListContainer.innerHTML = '<p class="no-data">등록된 분실물이 없습니다.</p>';
    } else {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        paginatedItems.forEach(item => {
            const card = document.createElement('div');
            card.className = `item-card ${item.status === 'claimed' ? 'claimed' : ''}`;

            let imagesHtml = `<div class="card-images" onclick="openImageLightbox('${item.id}')" title="사진 크게 보기">`;
            item.imageUrls.forEach(url => {
                imagesHtml += `<img src="${url}" alt="${item.name}">`;
            });
            imagesHtml += '</div>';

            // [수정] 본인 확인 후 '삭제' 버튼만 노출되도록 '주인 찾기' 버튼 로직 완전 제거
            let deleteBtnHtml = '';
            if (currentUser && item.authorUid === currentUser.uid) {
                deleteBtnHtml = `<button class="delete-btn" onclick="deleteItem('${item.id}')">삭제</button>`;
            }

            card.innerHTML = `
                ${imagesHtml}
                <div class="item-info">
                    <div class="card-title">${item.name}</div>
                    <div class="card-meta">장소: ${item.location}</div>
                    <div class="card-meta">날짜: ${item.date}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; gap:4px;">
                        <span class="badge">${categoryMap[item.category]}</span>
                        <div style="display:flex; gap:4px;">
                            ${deleteBtnHtml}
                        </div>
                    </div>
                </div>
            `;
            itemListContainer.appendChild(card);
        });
    }
    renderPagination(filteredItems.length);
}

function renderPagination(totalItems) {
    paginationTop.innerHTML = '';
    paginationBottom.innerHTML = '';

    let totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages < 1) totalPages = 1;

    let startPage = currentPage - 2;
    let endPage = currentPage + 2;

    if (startPage < 1) {
        endPage = endPage + (1 - startPage);
        startPage = 1;
    }
    if (endPage > totalPages) {
        startPage = startPage - (endPage - totalPages);
        endPage = totalPages;
    }
    startPage = Math.max(1, startPage);

    function createPaginationDOM(container) {
        if (startPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'page-btn';
            prevBtn.innerText = '〈';
            prevBtn.addEventListener('click', () => handlePageClick(startPage - 1));
            container.appendChild(prevBtn);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.innerText = i;
            pageBtn.addEventListener('click', () => handlePageClick(i));
            container.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'page-btn';
            nextBtn.innerText = '〉';
            nextBtn.addEventListener('click', () => handlePageClick(endPage + 1));
            container.appendChild(nextBtn);
        }
    }

    createPaginationDOM(paginationTop);
    createPaginationDOM(paginationBottom);
}

function handlePageClick(pageNumber) {
    currentPage = pageNumber;
    renderItems();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentCategory = button.getAttribute('data-category');
        currentPage = 1; 
        renderItems();
    });
});

function resetFilterButtons() {
    filterButtons.forEach(btn => {
        if (btn.getAttribute('data-category') === 'all') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}
