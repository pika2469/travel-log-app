import './style.css';

// DOM読込後に実行
document.addEventListener("DOMContentLoaded", async () => {
  
  // 国コード変換マップの読み込み
  await loadCountryCodeMap();

  const form = document.getElementById("register-form");
  const list = document.getElementById("log-list");

  // ブラウザのlocalStorageに保存されているデータを表示
  loadLogs();

  // 保存ボタンが押された場合の処理
  form.addEventListener("submit", async (e) => {

    // フォームのデフォルト動作（ページ再読み込み）を止める
    e.preventDefault();

    // 要素の取得を容易にするためにFormDataオブジェクトを作成
    const formData = new FormData(form);
    const location = formData.get("location");

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
      date: formData.get("date"),
      title: formData.get("title"),
      location,
      memo: formData.get("memo"),
      country,
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

    // 保存ボタンとリストの間に余白を入れる
    const spacer = document.createElement("div");
    spacer.className = "h-6";
    list.appendChild(spacer);


    logs.forEach((log) => {
      const div = document.createElement("div");
      div.className = `
        bg-white/10 backdrop-blur rounded-xl p-4 flex flex-col gap-2
        shadow border border-white/20 text-white/80
      `;

      // タイトルと日付
      const titleRow = document.createElement("div");
      titleRow.className = "flex justify-between items-center";
      titleRow.innerHTML = `
        <h3 class="text-white font-semibold text-base">${log.title}</h3>
        <span class="text-sm text-white/60">${log.date}</span>
      `;

      // 場所
      const locationRow = document.createElement("div");
      locationRow.className = "text-sm text-white/70";
      locationRow.innerHTML = `<strong>場所：</strong> ${log.location}`;

      // メモ
      const memoRow = document.createElement("div");
      memoRow.className = "text-sm text-white/60";
      memoRow.textContent = log.memo ? log.memo : "No data";

      // 削除ボタン
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "削除";
      deleteBtn.className = `
        mt-2 self-end bg-red-500 hover:bg-red-600 text-white text-xs
        rounded px-3 py-1 transition shadow
      `;
      deleteBtn.addEventListener("click", () => {
        if (!confirm("本当にこの記録を削除しますか？")) {
          return;
        }

        // キャッシュから削除
        const cache = JSON.parse(localStorage.getItem("locationCache") || "{}");
        delete cache[log.location];
        localStorage.setItem("locationCache", JSON.stringify(cache));

        const newLogs = logs.filter(l => l.id !== log.id);
        localStorage.setItem("travelLogs", JSON.stringify(newLogs));
        loadLogs();
      });

      div.appendChild(titleRow);
      div.appendChild(locationRow);
      div.appendChild(memoRow);
      div.appendChild(deleteBtn);
      list.appendChild(div);
    });
  }

});

// 国コードマップの保持
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