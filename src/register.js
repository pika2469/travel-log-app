import './style.css';

// DOM読込後に実行
document.addEventListener("DOMContentLoaded", async () => {
  
  // 国コード変換マップの読み込み
  await loadCountryCodeMap();

  const form = document.getElementById("register-form");
  const list = document.getElementById("log-list");
  const modalRoot = document.getElementById("modal-root");

  // ブラウザのlocalStorageに保存されているデータを表示
  loadLogs();

  // 保存ボタンが押された場合の処理
  form.addEventListener("submit", async (e) => {

    // フォームのデフォルト動作（ページ再読み込み）を止める
    e.preventDefault();

    // FormData取得
    const formData = new FormData(form);
    const date = formData.get("date");
    const title = formData.get("title");
    const location = formData.get("location");
    const memo = formData.get("memo");

    // 地名データ処理
    const primaryCity = location.split(/[、,]/)[0].trim();

    // cityProvinceLocationMappingと比較して、都市データが存在するか確認
    const cityMapStr = localStorage.getItem('cityProvinceLocationMapping') || "{}";
    const cityMap = JSON.parse(cityMapStr);
    const info = cityMap[primaryCity];

    let province_zh = null;
    let province_en = null;
    let lat = null;
    let lon = null;

    // 地名がデータベースにある場合
    if (info) {
      province_zh = info.province_zh;
      province_en = info.province_en;
      lat = info.lat;
      lon = info.lon;
    } else {
      const proceed = confirm(
        "この都市はデータベースに存在しません。マッピングはできませんが、記録は続けますか？"
      );
      if (!proceed) {
        return;
      }
    }


    // Nominatim APIによる国名取得と3桁コードへの変換
    let country = "UNK";
    try {
      const query = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&addressdetails=1`;
      const res = await fetch(query);
      const data = await res.json();

      if (data.length > 0 && data[0].address && data[0].address.country_code) {
        // Nominatimレスポンスから2桁コードの取得
        const alpha2 = data[0].address.country_code.toUpperCase();

        // 2桁コードを3桁コードへ変換
        country = convertAlpha2ToAlpha3(alpha2) || alpha2;
      }
    } catch (err) {
      console.error("国コードの取得に失敗しました", err);
      return;
    }

    // 記録の作成(フォーム送信データ + Nominatim APIで取得した国名)
    const newLog = {
      id: Date.now(),　// 現在時刻を使って一意なIDを作成
      date,
      title,
      location,
      memo,
      country,
      province_zh,
      province_en,
      lat,
      lon
    };

    // localStorageに保存されているデータを配列として取り出す
    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");

    // 現在の記録配列に、新しい記録を追加
    logs.push(newLog);

    // 再び配列をJSON文字列に変換してlocalStorageに保存
    localStorage.setItem("travelLogs", JSON.stringify(logs));

    form.reset();
    loadLogs();
  });

  // ----------------------------------------------------------
  // ログを画面に描画
  // ----------------------------------------------------------
  function loadLogs() {
    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
    
    // 日付の新しい順に並び替え
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // リストを初期化
    list.innerHTML = "";

    // リストのスタイル
    list.className = "flex flex-col gap-2";

    // 保存ボタンとリストの間に余白を入れる
    const spacer = document.createElement("div");
    spacer.className = "h-6";
    list.appendChild(spacer);


    logs.forEach((log) => {
      const card = document.createElement("div");
      card.className = `
        bg-white/10 backdrop-blur rounded-xl p-4 flex flex-col gap-2
        shadow border border-white/20 text-white/80
      `;

      // タイトルと日付
      const titleRow = document.createElement("div");
      titleRow.className = "flex justify-between items-center";

      const titleE1 = document.createElement("h3");
      titleE1.className = "text-white font-semibold text-base";
      titleE1.textContent = log.title;

      const dateE1 = document.createElement("span");
      dateE1.className = "text-sm text-white/60";
      dateE1.textContent = log.date;

      titleRow.appendChild(titleE1);
      titleRow.appendChild(dateE1);


      // 場所
      const locationRow = document.createElement("div");
      locationRow.className = "text-sm text-white/70";
      locationRow.innerHTML = `<strong>場所：</strong> ${log.location}`;

      // メモ
      const memoRow = document.createElement("div");
      memoRow.className = "text-sm text-white/60";
      memoRow.textContent = log.memo ? log.memo : "No data";

      // ボタン行
      const buttonRow = document.createElement("div");
      buttonRow.className = "flex gap-2 mt-2";
      
      // 編集ボタン
      const editBtn = document.createElement("button");
      editBtn.textContent = "編集";
      editBtn.className = "bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1 text-sm transition";
      editBtn.addEventListener("click", () => showEditModal(log));

      // 削除ボタン
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "削除";
      deleteBtn.className = "bg-red-600 hover:bg-red-500 text-white rounded px-3 py-1 text-sm transition";
      deleteBtn.addEventListener("click", () => handleDelete(log.id, log.location));

      buttonRow.appendChild(editBtn);
      buttonRow.appendChild(deleteBtn);

      card.appendChild(titleRow);
      card.appendChild(locationRow);
      card.appendChild(memoRow);
      card.appendChild(buttonRow);
      list.appendChild(card);
    });
  }

  function handleDelete(id, location, skipConfirm = false) {
    if (!skipConfirm && !confirm("本当にこの記録を削除しますか？")) return;

      // キャッシュから削除
      const cache = JSON.parse(localStorage.getItem("locationCache") || "{}");
      delete cache[location];
      localStorage.setItem("locationCache", JSON.stringify(cache));

      const logs = getLogs().filter(l => l.id !== id);
      saveLogs(logs);
      loadLogs();
  }

  // ----------------------------------------------------------
  // 編集モーダル
  // ----------------------------------------------------------
  function showEditModal(log) {
    modalRoot.innerHTML = "";

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50";

    // 画面外クリックで閉じる処理
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    const modal = document.createElement("div");
    modal.className = "bg-[#1f1f1f] rounded-xl p-6 max-w-sm w-full shadow-lg relative";

    const title = document.createElement("h2");
    title.className = "text-lg font-bold mb-4 text-white/90";
    title.textContent = "記録を編集";

    const form = document.createElement("form");
    form.className = "flex flex-col gap-3";

    // フォームの中身
    // date
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.name = "date";
    dateInput.value = log.date;
    dateInput.required = true;
    dateInput.className = "bg-white/10 backdrop-blur rounded-lg px-4 py-2 text-white/80 focus:ring focus:ring-blue-600 transition";

    // title
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.name = "title";
    titleInput.value = log.title;
    titleInput.required = true;
    titleInput.className = dateInput.className;
    
    // location
    const locInput = document.createElement("input");
    locInput.type = "text";
    locInput.name = "location";
    locInput.value = log.location;
    locInput.required = true;
    locInput.className = dateInput.className;

    // memo
    const memoInput = document.createElement("textarea");
    memoInput.name = "memo";
    memoInput.rows = 3;
    memoInput.textContent = log.memo || "";
    memoInput.className = dateInput.className;

    // ボタン行
    const buttonRow = document.createElement("div");
    buttonRow.className = "flex justify-end gap-2 mt-3";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.className = "bg-red-600 hover:bg-red-500 text-white rounded px-4 py-2 text-sm transition";
    deleteBtn.addEventListener("click", () => {
      if (confirm("本当に削除しますか？")) {
        handleDelete(log.id, log.location, true);
        closeModal();
      }
    });

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.textContent = "保存";
    saveBtn.className = "bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 text-sm transition";

    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(deleteBtn);

    form.appendChild(dateInput);
    form.appendChild(titleInput);
    form.appendChild(locInput);
    form.appendChild(memoInput);
    form.appendChild(buttonRow);

    // 保存ボタンを押した際の処理
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // 入力値取得
      const newDate = dateInput.value;
      const newTitle = titleInput.value;
      const newLocation = locInput.value;
      const newMemo = memoInput.value;

      // 元々のlocationと比較
      let updatedProvinceZh = log.province_zh;
      let updatedProvinceEn = log.province_en;
      let updatedLat = log.lat;
      let updatedLon = log.lon;

      if (newLocation !== log.location) {
        // locationが変更された場合は、cityProvinceLocationMappingを参照
        const newPrimaryCity = newLocation.split(/[、,]/)[0].trim();

        const cityMapStr = localStorage.getItem('cityProvinceLocationMapping') || "{}";
        const cityMap = JSON.parse(cityMapStr);
        const info = cityMap[newPrimaryCity];

        if (info) {
          updatedProvinceZh = info.province_zh;
          updatedProvinceEn = info.province_en;
          updatedLat = info.lat;
          updatedLon = info.lon;
        } else {
          alert("指定した都市がデータベースにありません。csvを更新してください。");
          return;
        }
      }

      const updateLog = {
        ...log,
        date: newDate,
        title: newTitle,
        location: newLocation,
        memo: newMemo,
        province_zh: updatedProvinceZh,
        province_en: updatedProvinceEn,
        lat: updatedLat,
        lon: updatedLon,
      };

      // 保存
      const logs = getLogs().map(l => l.id === log.id ? updateLog : l);
      saveLogs(logs);
      closeModal();
      loadLogs();
    });

    const closeBtn = document.createElement("button");
    closeBtn.id = "close-modal";
    closeBtn.className = "absolute top-2 right-2 text-white/50 hover:text-white text-xl";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", closeModal);

    modal.appendChild(title);
    modal.appendChild(form);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);

    modalRoot.appendChild(overlay);

  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  // -------------------------------------------------------
  // localStorage utils
  // -------------------------------------------------------
  function getLogs() {
    return JSON.parse(localStorage.getItem("travelLogs") || "[]");
  }

  function saveLogs(logs) {
    localStorage.setItem("travelLogs", JSON.stringify(logs));
  }

});

// ----------------------------------------------------------
// 国コード変換
// ----------------------------------------------------------
let countryCodeMap = {};

// codes.jsonを読み込み、変換用マップを構築
function loadCountryCodeMap() {
  
  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + '/';
  
  // const base = import.meta.env.BASE_URL;
  const url = `${basePath}codes.json`;
  console.log(`Loading country code map from: ${url}`);

  return fetch(url)
  .then(res => res.json())
  .then(data => {
    countryCodeMap = {};
    data.forEach(([alpha2, alpha3]) => {
      countryCodeMap[alpha2] = alpha3;
    });
  });
}

// 2文字コード → 3文字コード変換関数
function convertAlpha2ToAlpha3(code) {
  return countryCodeMap[code.toUpperCase()] || null;
}