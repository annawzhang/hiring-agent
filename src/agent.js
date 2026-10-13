// Hiring Agent：只能调用 Hire.* 白名单工具，规则拒绝时原样告诉用户。
(function (root) {
  const KEY = "hiring-agent-v1";
  const D = root.HireData;
  const H = root.Hire;

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.candidates) return s;
    } catch (e) { /* ignore */ }
    return H.initState();
  }
  function saveState(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

  function today() { return D.TODAY; }
  function byId(state, id) { return state.candidates.find((c) => c.id === id); }
  function jobTitle(id) { return H.jobOf(id).title; }

  function findCand(state, text) {
    const m = text.match(/C\d{3}/i);
    if (m) return byId(state, m[0].toUpperCase());
    const name = text.replace(/.*?(看看|推进|淘汰|邀约|筛一下|候选人)\s*/g, "").trim();
    if (name.length >= 2) {
      const hit = state.candidates.filter((c) => c.name.includes(name));
      if (hit.length === 1) return hit[0];
      if (hit.length > 1) return { ambiguous: hit.slice(0, 5) };
    }
    return null;
  }

  function toolList() {
    return [
      "list_sla — 列出超时停留候选人",
      "screen — 初筛打分（必须带证据）",
      "analytics — 某职位漏斗与校准摘要",
      "draft_message — 邀约/拒信/Offer 模板",
      "advance — 推进下一阶段（受规则约束）",
      "reject — 淘汰（必须给原因）",
      "reset — 重置本地演示数据",
    ];
  }

  function formatScreen(c, s) {
    const ev = s.attrs.filter((a) => a.evidence.length).slice(0, 3)
      .map((a) => `- ${a.name}（${a.points}分）：「${a.evidence[0].line}」`).join("\n");
    const ko = s.knockouts.map((k) => `${k.pass ? "✓" : "✕"}${k.name}`).join(" · ");
    return [
      `候选人 ${c.id} ${c.name} · ${jobTitle(c.job)} · 当前「${H.stageName(H.current(c).stage)}」`,
      `初筛 **${s.total}** 分 · 建议：**${s.rec}**`,
      s.reason,
      "证据摘录：",
      ev || "- （无命中证据）",
      `硬性条件：${ko}`,
    ].join("\n");
  }

  function runTool(state, name, args) {
    const log = { tool: name, args, ok: true };
    try {
      if (name === "list_sla") {
        const late = H.slaBreaches(state, today());
        log.result = late.length
          ? late.map((x) => `${x.cand.id} ${x.cand.name} · ${H.stageName(x.stage)} ${x.days}天/限${x.sla} · ${jobTitle(x.cand.job)}`).join("\n")
          : "当前没有超时停留的候选人。";
      } else if (name === "screen") {
        const c = byId(state, args.id);
        if (!c) throw new Error("找不到候选人");
        const s = H.screen(c, H.jobOf(c.job), H.weightsFor(state, H.jobOf(c.job)));
        log.result = formatScreen(c, s);
      } else if (name === "analytics") {
        const jobId = args.jobId || "J1";
        const a = H.analytics(state, jobId);
        const cal = a.interviewers.map((x) => `${x.name} ${x.calibration}（均分 ${x.avg.toFixed(2)}）`).join("；");
        const bins = a.bins.filter((b) => b.passRate != null)
          .map((b) => `${b.label} 通过率 ${(b.passRate * 100).toFixed(0)}%`).join(" · ");
        log.result = [
          `${jobTitle(jobId)} 漏斗：${a.funnel.map((f) => f.n).join(" → ")}`,
          `在流程 ${a.active} · 已入职 ${a.hired} · Offer 接受率 ${a.offerAccept == null ? "—" : (a.offerAccept * 100).toFixed(0) + "%"}`,
          `面试官校准：${cal || "—"}`,
          `初筛分档 vs 现场面：${bins || "—"}`,
        ].join("\n");
      } else if (name === "draft_message") {
        const c = byId(state, args.id);
        if (!c) throw new Error("找不到候选人");
        const kind = args.kind || "invite";
        const msg = H.message(kind, c, {
          stage: H.stageName(H.current(c).stage),
          slots: "周三 14:00 / 周四 10:30 / 周五 16:00",
        });
        log.result = `【${kind} 模板】\n${msg}`;
      } else if (name === "advance") {
        const c = H.advance(state, args.id, today());
        saveState(state);
        log.result = `已推进 ${c.id} ${c.name} →「${H.stageName(H.current(c).stage)}」`;
      } else if (name === "reject") {
        H.reject(state, args.id, args.reason, today());
        saveState(state);
        const c = byId(state, args.id);
        log.result = `已淘汰 ${c.id} ${c.name}（${args.reason}）。拒信不写具体原因。\n` + H.message("reject", c);
      } else if (name === "reset") {
        state = H.initState();
        saveState(state);
        log.result = "已重置演示数据。";
        return { state, log };
      } else {
        throw new Error("未知工具：" + name);
      }
    } catch (e) {
      log.ok = false;
      log.result = "规则拒绝：" + e.message;
    }
    return { state, log };
  }

  function detect(text) {
    const t = text.trim();
    if (/^(帮助|help|你能做什么)/i.test(t)) return { tool: "help" };
    if (/重置/.test(t)) return { tool: "reset" };
    if (/超时|SLA|催一催|停留太久/.test(t)) return { tool: "list_sla" };
    if (/分析|漏斗|校准|渠道/.test(t)) {
      const jobId = /数据分析/.test(t) ? "J2" : "J1";
      return { tool: "analytics", args: { jobId } };
    }
    if (/邀约|拒信|offer模板|Offer模板/i.test(t)) {
      return { tool: "draft_message", needCand: true, args: { kind: /拒/.test(t) ? "reject" : /offer/i.test(t) ? "offer" : "invite" } };
    }
    if (/推进|进入下一/.test(t)) return { tool: "advance", needCand: true, args: {} };
    if (/淘汰|不录用|拒掉/.test(t)) {
      const reason = D.REJECT_REASONS.find((r) => t.includes(r)) || "";
      return { tool: "reject", needCand: true, args: { reason } };
    }
    if (/初筛|评分|筛一下|匹配|看看/.test(t) || /C\d{3}/i.test(t)) {
      return { tool: "screen", needCand: true, args: {} };
    }
    return { tool: "help" };
  }

  function reply(userText, state) {
    const intent = detect(userText);
    const toolsUsed = [];

    if (intent.tool === "help") {
      return {
        state,
        text: "我是招聘运营 Agent，只能调用结构化招聘引擎，不会编造简历。\n\n可试：\n- 有哪些超时候选人？\n- 初筛看看 C003 / 帮我筛一下张三\n- 推进 C003\n- 淘汰 C003 经验与岗位不匹配\n- 写一封邀约给 C003\n- AI 产品经理招聘分析\n- 重置\n\n工具白名单：\n" + toolList().map((x) => "· " + x).join("\n"),
        toolsUsed,
      };
    }

    let args = { ...(intent.args || {}) };
    if (intent.needCand) {
      const found = findCand(state, userText);
      if (found && found.ambiguous) {
        return {
          state,
          text: "找到多位同名候选人，请用工号指定：\n" + found.ambiguous.map((c) => `${c.id} ${c.name} · ${jobTitle(c.job)} · ${H.stageName(H.current(c).stage)}`).join("\n"),
          toolsUsed,
        };
      }
      if (!found) {
        return { state, text: "请带上候选人工号（如 C003）或完整姓名。我不会在没有对象时执行推进/淘汰。", toolsUsed };
      }
      args.id = found.id;
    }
    if (intent.tool === "reject" && !args.reason) {
      return {
        state,
        text: "淘汰必须选择原因之一：\n" + D.REJECT_REASONS.map((r) => "· " + r).join("\n") + "\n例：淘汰 C003 经验与岗位不匹配",
        toolsUsed,
      };
    }

    const out = runTool(state, intent.tool, args);
    toolsUsed.push(out.log);
    const prefix = out.log.ok ? `✓ 已调用 \`${out.log.tool}\`\n\n` : `✗ 工具 \`${out.log.tool}\`\n\n`;
    return { state: out.state, text: prefix + out.log.result, toolsUsed };
  }

  root.HiringAgent = { loadState, saveState, reply, toolList, today };
})(typeof window !== "undefined" ? window : globalThis);
