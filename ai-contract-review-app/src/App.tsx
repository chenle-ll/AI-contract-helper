import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, exportUrl } from "./api";
import type { Contract, IssueAction, Review, ReviewIssue, RiskLevel } from "./types";

const riskNames: Record<RiskLevel, string> = { high: "高风险", medium: "中风险", low: "低风险", tip: "提示" };

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    report: <><path d="M4 19V5M4 19h17M8 16v-4M13 16V7M18 16v-6"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></>,
    back: <><path d="m15 18-6-6 6-6"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const nav = [
  ["home", "首页", "/"], ["plus", "新建审查", "/new"], ["file", "我的合同", "/contracts"],
  ["report", "审查报告", "/reports"], ["users", "用户与权限", "/admin"],
];

function Layout({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <div className="app"><aside className="sidebar"><Link className="brand" to="/"><div className="brand-mark"></div><div><strong>衡鉴</strong><small>CONTRACT INTELLIGENCE</small></div></Link><nav className="nav">{nav.map(([icon, label, href]) => <NavLink key={href} to={href} end={href === "/"} className={({ isActive }) => isActive ? "active" : ""}><Icon name={icon}/><span>{label}</span></NavLink>)}</nav><div className="side-foot"><div className="security-note"><Icon name="shield" size={16}/><span>合同数据加密存储<br/>模型调用由服务端代理</span></div><div className="user-mini"><div className="avatar">陈</div><span>陈法务<small>企业法务 · 管理员</small></span></div></div></aside><main className="main"><header className="topbar"><div className="crumb"><span>AI 合同审查</span><span>/</span><strong>{title}</strong></div><div className="top-actions">{action}<button className="btn small" onClick={() => window.alert("暂无新通知")}>通知</button></div></header><div className="content"><div className="page-heading"><div><div className="eyebrow">LEGAL REVIEW WORKSPACE</div><h1>{title}</h1><p>{subtitle}</p></div></div>{children}</div></main></div>;
}

function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { api.contracts().then((x) => setContracts(x.contracts)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return { contracts, loading, error };
}

function ContractTable({ rows }: { rows: Contract[] }) {
  if (!rows.length) return <Empty title="还没有审查记录" text="上传第一份合同，完成 AI 初审后会显示在这里。" action={<Link className="btn primary" to="/new">新建审查</Link>}/>;
  return <div className="table-card"><table className="table"><thead><tr><th>合同名称</th><th>类型</th><th>立场</th><th>更新时间</th><th>状态</th><th>整体风险</th><th></th></tr></thead><tbody>{rows.map((contract) => <tr key={contract.id}><td><div className="doc-cell"><div className="file-icon">{contract.fileName.toLowerCase().endsWith("pdf") ? "PDF" : "DOCX"}</div><div><strong>{contract.name}</strong><small>{contract.fileName}</small></div></div></td><td>{contract.contractType}</td><td>{contract.reviewStance}</td><td>{new Date(contract.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td><span className={`status ${contract.status === "completed" ? "done" : contract.status === "reviewing" ? "reviewing" : "draft"}`}>{contract.status === "completed" ? "审查完成" : contract.status === "reviewing" ? "审查中" : "审查失败"}</span></td><td>{contract.overallRiskLevel ? <span className={`risk ${contract.overallRiskLevel}`}>{riskNames[contract.overallRiskLevel]}</span> : "—"}</td><td>{contract.reviewId ? <Link className="btn small" to={`/review/${contract.reviewId}`}>查看</Link> : "—"}</td></tr>)}</tbody></table></div>;
}

function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty"><div className="empty-mark"><Icon name="file" size={28}/></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Dashboard() {
  const { contracts, loading, error } = useContracts();
  const complete = contracts.filter((x) => x.status === "completed").length;
  const high = contracts.filter((x) => x.overallRiskLevel === "high").length;
  return <Layout title="首页" subtitle="查看合同风险与审查进度。" action={<Link className="btn primary small" to="/new"><Icon name="plus"/>新建审查</Link>}><div className="home-grid"><section className="hero-panel"><div className="hero-copy"><div className="eyebrow">AI FIRST PASS · HUMAN DECISION</div><h2>让每一次合同初审，<br/>都有迹可循。</h2><p>上传合同草案，衡鉴会调用 DeepSeek 定位风险条款、解释问题并给出可编辑的修改建议。AI 负责发现，最终决定始终由你掌握。</p><div className="hero-actions"><Link className="btn primary" to="/new"><Icon name="upload"/>上传合同开始审查</Link><Link className="btn" to="/contracts">查看审查记录</Link></div><div className="trust-row"><span className="trust-item"><i className="trust-dot"></i>原文可追溯</span><span className="trust-item"><i className="trust-dot"></i>人工逐条复核</span><span className="trust-item"><i className="trust-dot"></i>密钥服务端隔离</span></div></div></section><div className="metric-stack"><div className="metric-card"><div><span>审查任务</span><div className="number">{String(contracts.length).padStart(2, "0")}</div></div><Icon name="file" size={30}/></div><div className="metric-card light"><div><span>已完成</span><div className="number">{String(complete).padStart(2, "0")}</div></div><span>结果已留痕</span></div><div className="metric-card light"><div><span>高风险合同</span><div className="number">{String(high).padStart(2, "0")}</div></div><span>需人工复核</span></div></div></div><section className="section"><div className="section-head"><h2>最近审查</h2><Link to="/contracts">查看全部合同 →</Link></div>{loading ? <Loading label="正在读取审查记录"/> : error ? <ErrorBox message={error}/> : <ContractTable rows={contracts.slice(0, 4)}/>}</section></Layout>;
}

function NewReview() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("服务合同");
  const [stance, setStance] = useState("甲方");
  const [template, setTemplate] = useState("通用审查模板 V1.2");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const chooseFile = (value: File | null) => { setFile(value); if (value) setName(value.name.replace(/\.[^.]+$/, "")); };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!file && !text.trim()) return setError("请上传合同或粘贴合同文本");
    if (file && file.size > 20 * 1024 * 1024) return setError("文件超过 20MB，请压缩后重新上传");
    const form = new FormData();
    if (file) form.append("file", file);
    form.append("pastedText", text); form.append("contractName", name); form.append("contractType", type); form.append("stance", stance); form.append("template", template);
    setSubmitting(true);
    try { const { review } = await api.createReview(form); navigate(`/review/${review.id}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "审查失败，请重试"); setSubmitting(false); }
  }
  return <Layout title="新建审查" subtitle="上传合同并设定审查立场，系统将调用 DeepSeek 完成结构化初审。"><form className="form-shell" onSubmit={submit}><section className="form-card"><h2 className="form-title">合同与审查设置</h2><p className="form-sub">支持 Word、PDF、TXT，也可直接粘贴合同正文。</p><label className="dropzone">{file ? <div className="file-ready"><div className="file-icon">{file.name.split(".").pop()?.toUpperCase()}</div><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · 等待解析</small></div><button type="button" className="remove-file" onClick={(event) => { event.preventDefault(); chooseFile(null); }}>移除</button></div> : <div><div className="drop-icon"><Icon name="upload"/></div><strong>点击选择合同文件</strong><p>支持 .docx、.pdf、.txt，单个文件不超过 20MB</p></div>}<input type="file" accept=".docx,.pdf,.txt" onChange={(event) => chooseFile(event.target.files?.[0] || null)}/></label><div className="or-line"><span>或粘贴合同文本</span></div><textarea className="textarea contract-paste" value={text} onChange={(event) => setText(event.target.value)} placeholder="将合同正文粘贴到这里……"></textarea><div className="form-grid"><div className="field full"><label>合同名称 <em>*</em></label><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="文件上传后自动读取，也可手动修改"/></div><div className="field"><label>合同类型 <em>*</em></label><select className="select" value={type} onChange={(event) => setType(event.target.value)}>{["通用合同", "采购合同", "销售合同", "服务合同", "保密协议", "租赁合同"].map((x) => <option key={x}>{x}</option>)}</select></div><div className="field"><label>审查立场 <em>*</em></label><select className="select" value={stance} onChange={(event) => setStance(event.target.value)}>{["甲方", "乙方", "买方", "卖方", "中立"].map((x) => <option key={x}>{x}</option>)}</select></div><div className="field full"><label>审查模板 <em>*</em></label><select className="select" value={template} onChange={(event) => setTemplate(event.target.value)}><option>通用审查模板 V1.2</option><option>采购合同重点审查 V1.0</option><option>数据合规审查 V1.1</option></select></div></div>{error && <ErrorBox message={error}/>}<div className="form-actions"><Link className="btn" to="/">取消</Link><button className="btn primary" type="submit" disabled={submitting}>{submitting ? "DeepSeek 审查中…" : "开始 AI 审查"}</button></div></section><aside className="side-info"><h3>{submitting ? "正在进行智能审查" : "本次审查将进行"}</h3><ul>{[["1", "结构解析", "识别主体、金额、日期和关键条款"], ["2", "七维风险检查", "法律、合规、商业、缺失、模糊、一致性与格式"], ["3", "结构化结果校验", "校验风险等级、原文定位与建议字段"], ["4", "人工复核", "所有修改需由你逐条确认后生效"]].map((x) => <li key={x[0]}><b>{x[0]}</b><div><strong>{x[1]}</strong><p>{x[2]}</p></div></li>)}</ul>{submitting && <div className="progress-line"><i></i><span>普通合同通常需要 30 秒至 3 分钟，请勿关闭页面。</span></div>}</aside></form></Layout>;
}

function useReview(id?: string) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { if (!id) { setLoading(false); return; } api.review(id).then((x) => setReview(x.review)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [id]);
  return { review, setReview, loading, error };
}

function ReviewPage() {
  const { id } = useParams();
  const { review, setReview, loading, error } = useReview(id);
  const [activeId, setActiveId] = useState("");
  const [filter, setFilter] = useState("全部");
  const [editing, setEditing] = useState("");
  const [editText, setEditText] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => { if (review && !activeId) setActiveId(review.issues[0]?.id || ""); }, [review, activeId]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2400); return () => clearTimeout(timer); }, [toast]);
  if (loading) return <LoadingScreen/>;
  if (error || !review) return <Layout title="审查工作台" subtitle="无法读取审查结果"><ErrorBox message={error || "审查任务不存在"}/></Layout>;
  const visible = review.issues.filter((issue) => filter === "全部" || filter === "高风险" && issue.riskLevel === "high" || filter === "未处理" && issue.userAction === "pending");
  const active = review.issues.find((x) => x.id === activeId) || review.issues[0];
  async function act(issue: ReviewIssue, action: IssueAction, editedText?: string) {
    if (!id) return;
    try {
      const { issue: updated } = await api.updateIssue(id, issue.id, action, editedText);
      setReview((current) => current ? { ...current, issues: current.issues.map((item) => item.id === updated.id ? updated : item) } : current);
      setEditing(""); setToast(action === "reject" ? "已保留合同原文" : action === "ignore" ? "已标记为查看" : "建议已应用到修订状态");
    } catch (reason) { setToast(reason instanceof Error ? reason.message : "操作失败"); }
  }
  const counts = (level: RiskLevel) => review.issues.filter((x) => x.riskLevel === level).length;
  return <div className="review-app"><header className="review-top"><Link className="back-link" to="/"><Icon name="back"/></Link><div className="review-logo">衡鉴</div><div className="review-title"><strong>{review.contract.name}</strong><small>{review.contract.contractType} · {new Date(review.finishedAt).toLocaleString("zh-CN")} 完成 AI 审查</small></div><div className="review-meta"><span className="meta-chip">{review.contract.reviewStance}立场</span><span className="meta-chip">{review.templateVersion}</span></div><div className="review-actions"><a className="btn small" href={exportUrl(review.id, "word")}><Icon name="download"/>导出 Word</a><a className="btn small" href={exportUrl(review.id, "pdf")}><Icon name="download"/>导出 PDF</a><Link className="btn primary small" to={`/report/${review.id}`}>查看报告</Link></div></header><div className="review-layout"><aside className="outline-panel"><div className="panel-title"><span>风险目录</span><span>{review.issues.length} 条</span></div><div className="risk-summary">{(["high", "medium", "low", "tip"] as RiskLevel[]).map((level) => <div className="risk-count" key={level}><strong className={`text-${level}`}>{counts(level)}</strong><span>{riskNames[level]}</span></div>)}</div><div className="outline-list">{review.issues.map((issue) => <button key={issue.id} className={`outline-item ${issue.id === activeId ? "active" : ""}`} onClick={() => setActiveId(issue.id)}><span>{issue.clauseId} · {issue.issueType}</span><i className={`risk-pin pin-${issue.riskLevel}`}></i></button>)}</div></aside><main className="document-area"><article className="paper review-paper"><h1>{review.contract.name}</h1><div className="contract-no">AI 解析文本 · 原文位置可追溯</div>{review.contractText.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{active && paragraph.includes(active.originalText) ? <>{paragraph.slice(0, paragraph.indexOf(active.originalText))}<mark className={`risk-text ${active.riskLevel === "medium" ? "medium" : active.riskLevel === "low" ? "low" : ""}`}>{active.originalText}</mark>{paragraph.slice(paragraph.indexOf(active.originalText) + active.originalText.length)}</> : paragraph}</p>)}</article></main><aside className="comment-panel"><div className="comment-head"><strong>AI 审查意见 · {review.issues.filter((x) => x.userAction === "pending").length} 条待处理</strong><div className="filter-tabs">{["全部", "高风险", "未处理"].map((x) => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x}</button>)}</div></div><div className="issue-list">{visible.map((issue) => <article key={issue.id} className={`issue-card ${activeId === issue.id ? "active" : ""} ${issue.userAction !== "pending" ? "resolved" : ""}`} onClick={() => setActiveId(issue.id)}><div className="issue-top"><span className={`risk ${issue.riskLevel}`}>{riskNames[issue.riskLevel]} · {issue.issueType}</span><span className="issue-index">{issue.location}</span></div><h3>{issue.clauseId}</h3><p className="quote">原文：{issue.originalText}</p><p>{issue.reason}</p><p className="suggestion"><strong>建议修改</strong><br/>{issue.editedText || issue.suggestionText}</p><p className="basis">修改依据：{issue.basis}</p>{issue.userAction === "pending" && editing !== issue.id ? <div className="issue-actions"><button className="action-btn accept" onClick={(event) => { event.stopPropagation(); act(issue, "accept"); }}>接受</button><button className="action-btn" onClick={(event) => { event.stopPropagation(); act(issue, "reject"); }}>拒绝</button><button className="action-btn" onClick={(event) => { event.stopPropagation(); setEditing(issue.id); setEditText(issue.suggestionText); }}>编辑</button><button className="action-btn" onClick={(event) => { event.stopPropagation(); act(issue, "ignore"); }}>忽略</button></div> : editing === issue.id ? <div className="edit-box" onClick={(event) => event.stopPropagation()}><textarea value={editText} onChange={(event) => setEditText(event.target.value)}></textarea><div className="edit-actions"><button className="btn small" onClick={() => setEditing("")}>取消</button><button className="btn primary small" onClick={() => act(issue, "edit", editText)}>保存并应用</button></div></div> : <div className="resolved-stamp">{issue.userAction === "reject" ? "已拒绝，保留原文" : issue.userAction === "ignore" ? "已查看，未处理" : "已采纳并应用"}</div>}</article>)}</div></aside></div>{toast && <div className="toast">{toast}</div>}</div>;
}

function ReportPage() {
  const { id } = useParams();
  const { review, loading, error } = useReview(id);
  if (loading) return <LoadingScreen/>;
  if (error || !review) return <Layout title="审查报告" subtitle="无法读取报告"><ErrorBox message={error || "报告不存在"}/></Layout>;
  const counts = (level: RiskLevel) => review.issues.filter((x) => x.riskLevel === level).length;
  const max = Math.max(1, ...(["high", "medium", "low", "tip"] as RiskLevel[]).map(counts));
  return <Layout title="审查报告" subtitle={`${review.contract.name} · ${review.contract.contractType}`} action={<><a className="btn small" href={exportUrl(review.id, "pdf")}><Icon name="download"/>导出 PDF</a><Link className="btn primary small" to={`/review/${review.id}`}>返回审查页</Link></>}><section className="report-cover"><div><div className="eyebrow report-eyebrow">REVIEW SUMMARY · {review.templateVersion}</div><h2>整体风险等级：{riskNames[review.overallRiskLevel]}</h2><p>审查立场：{review.contract.reviewStance} · 审查时间：{new Date(review.finishedAt).toLocaleString("zh-CN")}</p><p>模型版本：{review.modelVersion}</p></div><div className="risk-score"><div className="score-ring">{Math.min(99, counts("high") * 18 + counts("medium") * 8 + counts("low") * 2)}<small>风险指数</small></div><div><strong>建议法务重点复核</strong><p>高风险意见 {counts("high")} 条</p></div></div></section><div className="report-grid"><section className="report-card"><h3>风险分布</h3>{(["high", "medium", "low", "tip"] as RiskLevel[]).map((level) => <div className="bar-row" key={level}><span>{riskNames[level]}</span><div className="bar"><i className={`bar-${level}`} style={{ width: `${counts(level) / max * 100}%` }}></i></div><strong>{counts(level)}</strong></div>)}<h3 className="report-subtitle">主要风险摘要</h3>{review.issues.slice(0, 6).map((issue) => <div className="finding" key={issue.id}><span className={`risk ${issue.riskLevel}`}>{riskNames[issue.riskLevel]}</span><strong>{issue.issueType} · {issue.clauseId}</strong><p>{issue.reason}</p></div>)}</section><aside><section className="report-card"><h3>审查结论</h3><p className="report-summary">{review.summary}</p><div className="next-step"><strong>建议下一步</strong>{review.nextSteps.map((step, index) => <span key={step}>{index + 1}. {step}</span>)}</div></section><section className="report-card report-gap"><h3>缺失条款提示</h3>{review.missingClauses.length ? review.missingClauses.map((item) => <div className="finding" key={item.name}><span className={`risk ${item.riskLevel}`}>{riskNames[item.riskLevel]}</span><strong>{item.name}</strong><p>{item.reason}</p><p>建议：{item.suggestion}</p></div>) : <p className="report-summary">未发现明显缺失条款。</p>}</section></aside></div></Layout>;
}

function ContractsPage({ reportMode = false }: { reportMode?: boolean }) {
  const { contracts, loading, error } = useContracts();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => contracts.filter((x) => !query || x.name.includes(query) || x.fileName.includes(query)), [contracts, query]);
  return <Layout title={reportMode ? "审查报告" : "我的合同"} subtitle={reportMode ? "查看已完成审查的结构化报告。" : "查看你有权访问的合同、审查任务与处理状态。"} action={<Link className="btn primary small" to="/new"><Icon name="plus"/>新建审查</Link>}><div className="search-row"><div className="search"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索合同名称或文件名"/></div></div>{loading ? <Loading label="正在读取合同"/> : error ? <ErrorBox message={error}/> : <ContractTable rows={reportMode ? rows.filter((x) => x.status === "completed") : rows}/>}</Layout>;
}

function AdminPage() {
  const [users, setUsers] = useState([["陈嘉宁", "法务人员", true], ["林知夏", "普通用户", true], ["周可", "系统管理员", true], ["许安", "普通用户", false]] as [string, string, boolean][]);
  return <Layout title="用户与权限" subtitle="演示版角色权限；生产环境应接入企业身份认证。"><div className="table-card"><table className="table"><thead><tr><th>用户</th><th>角色</th><th>可访问范围</th><th>状态</th><th>操作</th></tr></thead><tbody>{users.map((user, index) => <tr key={user[0]}><td><div className="user-cell"><div className="avatar">{user[0][0]}</div><strong>{user[0]}</strong></div></td><td><select className="role-select" value={user[1]} onChange={(event) => setUsers((current) => current.map((x, i) => i === index ? [x[0], event.target.value, x[2]] : x))}>{["普通用户", "法务人员", "系统管理员"].map((x) => <option key={x}>{x}</option>)}</select></td><td>{user[1] === "普通用户" ? "本人合同" : "全部授权合同"}</td><td><span className={`status ${user[2] ? "done" : "draft"}`}>{user[2] ? "启用" : "停用"}</span></td><td><button className={`toggle ${user[2] ? "on" : ""}`} onClick={() => setUsers((current) => current.map((x, i) => i === index ? [x[0], x[1], !x[2]] : x))}><i></i></button></td></tr>)}</tbody></table></div><div className="security-callout"><Icon name="shield" size={22}/><div><strong>权限实现说明</strong><p>当前版本完成角色界面和服务端审计留痕。正式部署前应接入企业 SSO，并在所有合同与审查接口增加基于用户身份的行级权限校验。</p></div></div></Layout>;
}

function Loading({ label }: { label: string }) { return <div className="loading"><i></i><span>{label}</span></div>; }
function LoadingScreen() { return <div className="full-loading"><Loading label="正在加载审查结果"/></div>; }
function ErrorBox({ message }: { message: string }) { return <div className="error-box"><strong>未能完成操作</strong><span>{message}</span></div>; }

export default function App() {
  return <Routes><Route path="/" element={<Dashboard/>}/><Route path="/new" element={<NewReview/>}/><Route path="/review/:id" element={<ReviewPage/>}/><Route path="/report/:id" element={<ReportPage/>}/><Route path="/contracts" element={<ContractsPage/>}/><Route path="/reports" element={<ContractsPage reportMode/>}/><Route path="/admin" element={<AdminPage/>}/><Route path="*" element={<Dashboard/>}/></Routes>;
}
