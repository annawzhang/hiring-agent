(function () {
  let state = HiringAgent.loadState();
  const log = document.getElementById("log");
  const form = document.getElementById("form");
  const input = document.getElementById("q");
  const chips = document.getElementById("chips");

  const SUGGEST = [
    "你能做什么？",
    "有哪些超时候选人？",
    "AI 产品经理招聘分析",
    "初筛看看排队最久的人",
  ];

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function md(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function add(role, html) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function ask(text) {
    const t = text.trim();
    if (!t) return;
    add("user", esc(t));

    // 快捷：初筛排队最久 → 先 list_sla 再 screen 第一个
    let query = t;
    if (/初筛看看排队最久/.test(t)) {
      const late = Hire.slaBreaches(state, HiringAgent.today());
      if (!late.length) {
        add("bot", "当前没有超时候选人可筛。");
        return;
      }
      query = "初筛 " + late[0].cand.id;
    }

    const res = HiringAgent.reply(query, state);
    state = res.state;
    HiringAgent.saveState(state);
    let html = md(res.text);
    if (res.toolsUsed && res.toolsUsed.length) {
      html += `<div class="tools">tools: ${res.toolsUsed.map((x) => esc(x.tool) + (x.ok ? "✓" : "✗")).join(", ")}</div>`;
    }
    add("bot", html);
  }

  chips.innerHTML = SUGGEST.map((s) => `<button type="button" data-q="${esc(s)}">${esc(s)}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-q]");
    if (b) ask(b.dataset.q);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
    input.value = "";
  });

  add("bot", "你好。我是招聘运营 Agent：超时催办、证据化初筛、受规则约束的推进/淘汰、邀约模板与分析摘要。发送「你能做什么？」查看白名单。");
})();
