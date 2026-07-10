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

// 파이어베이스 인스턴스 초기화
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

// [수정] 구글 인증 단일 처리를 위한 타겟팅 조정
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loggedOutArea = document.getElementById('logged-out-area');
const loggedInArea = document.getElementById('logged-in-area');
const userInfoSpan = document.getElementById('user-info');

const categoryMap = {
    wallet: '지갑 · 카드',
    electronics: '전자기기',
    jewelry: '액세서리',
    cosmetics: '화장품',
    others: '기타'
};

// 이미지 파일 압축 프로세서
function compressAndConvertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500; 
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

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                resolve(compressedBase64);
            };
        };
        reader.onerror = error => reject(error);
    });
}

// ─── [수정] 1. 구글 팝업 인증 처리 일원화 ───
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
        userInfoSpan.innerText = `${user.displayName}님`; // 구글 프로필 실명 바인딩
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

// 2. 클라우드 실시간 데이터베이스(Firestore) 동기화 감지
db.collection("lostItems").orderBy("timestamp", "asc").onSnapshot((snapshot) => {
    lostItems = [];
    snapshot.forEach((doc) => {
        lostItems.push({ id: doc.id, ...doc.data() });
    });
    renderItems();
});

// 3. 등록 패널 제어
openModalBtn.addEventListener('click', () => {
    modal.style.display = 'block';
    setTimeout(() => { modal.classList.add('show'); }, 10);
});
function closeSidePage() {
    lostItemForm.reset();
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

// 4. 분실물 등록 처리
lostItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("로그인이 필요한 작업입니다.");

    const category = document.getElementById('item-category').value;
    const name = document.getElementById('item-name').value;
    const location = document.getElementById('item-location').value;
    const imageFiles = document.getElementById('item-images').files;

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

        closeSidePage();
        alert('서버에 분실물이 안전하게 기록되었습니다!');
    } catch (err) {
        alert("등록 실패: " + err.message);
    } finally {
        submitBtn.innerText = "등록하기";
        submitBtn.disabled = false;
    }
});

// 5. 주인 찾음 상태 전환
function toggleClaimStatus(id) {
    if (!currentUser) return alert("로그인 후 이용하실 수 있습니다.");
    
    if (confirm("이 분실물을 수령 완료 상태로 전환하시겠습니까?")) {
        db.collection("lostItems").doc(id).update({
            status: 'claimed'
        }).then(() => {
            alert('수령 처리가 완료되었습니다.');
        }).catch(err => alert("수정 실패: " + err.message));
    }
}

// 6. 화면 데이터 및 페이지네이션 렌더링 함수
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

            let imagesHtml = '<div class="card-images">';
            item.imageUrls.forEach(url => {
                imagesHtml += `<img src="${url}" alt="${item.name}">`;
            });
            imagesHtml += '</div>';

            let buttonHtml = '';
            if (item.status === 'claimed') {
                buttonHtml = `<button class="status-btn completed" disabled>수령 완료</button>`;
            } else {
                if (!currentUser) {
                    buttonHtml = `<button class="status-btn completed" disabled title="로그인이 필요합니다">주인 찾음</button>`;
                } else {
                    buttonHtml = `<button class="status-btn" onclick="toggleClaimStatus('${item.id}')">주인 찾음</button>`;
                }
            }

            card.innerHTML = `
                ${imagesHtml}
                <div class="item-info">
                    <div class="card-title">${item.name}</div>
                    <div class="card-meta">장소: ${item.location}</div>
                    <div class="card-meta">날짜: ${item.date}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                        <span class="badge">${categoryMap[item.category]}</span>
                        ${buttonHtml}
                    </div>
                </div>
            `;
            itemListContainer.appendChild(card);
        });
    }
    renderPagination(filteredItems.length);
}

// 5개 제한 페이지네이션
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
