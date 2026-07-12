import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, matchPath, useLocation, useNavigate } from "react-router-dom";
import type { AdminSettings, BatchConfig, GroupConfig, JobRecord, JobStatus, ResultFile } from "../shared/types";
import { api } from "./api";

const statusLabel: Record<JobStatus, string> = { queued: "排队中", running: "执行中", succeeded: "已完成", needs_review: "待审核", failed: "失败", cancelled: "已取消", interrupted: "已中断" };

function tagsFrom(value: string) { return [...new Set(value.split(/[,，]/).map((item) => item.trim()).filter(Boolean))]; }
function assetFolder(relativePath: string) { const index = relativePath.lastIndexOf("/"); return index < 0 ? "" : relativePath.slice(0, index); }
function folderLabel(folder: string) { return folder || "根目录"; }
function duration(job: JobRecord) {
  const start = new Date(job.startedAt ?? job.createdAt).getTime(); const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000)); return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}
function formatDate(value: string) { return new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }); }

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchConfig[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({ concurrency: 1 });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const batchId = matchPath({ path: "/batches/:batchId", end: true }, location.pathname)?.params.batchId ?? "";
  const resultJobId = matchPath({ path: "/results/:jobId", end: true }, location.pathname)?.params.jobId ?? "";
  const batch = batches.find((item) => item.id === batchId);
  const setBatchId = (id: string) => navigate(id ? `/batches/${encodeURIComponent(id)}` : "/batches/new");
  const refreshBatches = async (preferredId?: string) => { const data = await api.batches(); setBatches(data); if (preferredId) setBatchId(preferredId); };
  const refreshJobs = async () => setJobs(await api.jobs());
  const perform = async <T,>(action: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setError(""); try { const result = await action(); if (success) setNotice(success); return result; }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return undefined; }
  };

  useEffect(() => { void Promise.all([api.batches(), api.jobs(), api.settings()]).then(([batchData, jobData, settingData]) => { setBatches(batchData); setJobs(jobData); setSettings(settingData); }).catch((reason) => setError(`无法连接本地 API：${reason.message}`)).finally(() => setLoaded(true)); }, []);
  useEffect(() => {
    const active = jobs.filter((job) => job.status === "queued" || job.status === "running");
    const streams = active.map((job) => { const stream = new EventSource(`/api/jobs/${job.id}/events`); stream.onmessage = (event) => { const payload = JSON.parse(event.data); setJobs((current) => current.map((item) => item.id === payload.job.id ? payload.job : item)); }; stream.onerror = () => stream.close(); return stream; });
    return () => streams.forEach((stream) => stream.close());
  }, [jobs.map((job) => `${job.id}:${job.status}`).join("|")]);

  const updateBatch = (updated: BatchConfig) => { setBatches((current) => current.map((item) => item.id === updated.id ? updated : item)); if (batchId !== updated.id) setBatchId(updated.id); };
  const showResult = (id: string) => navigate(`/results/${encodeURIComponent(id)}`);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">M</span><div><strong>Meme 业务管理台</strong><small>本地批量分析与审核</small></div></div>
      <nav aria-label="主导航">
        <NavLink to="/batches">素材与批次 <span className="count">{batches.length}</span></NavLink>
        <NavLink to="/jobs">任务中心 <span className="count">{jobs.filter((job) => job.status === "queued" || job.status === "running").length}</span></NavLink>
        <NavLink to={resultJobId ? `/results/${encodeURIComponent(resultJobId)}` : "/results"}>结果审核</NavLink>
      </nav>
      <div className="local-badge"><span /> localhost</div>
    </header>
    {(error || notice) && <div className={`toast ${error ? "danger" : ""}`} role="status">{error || notice}<button onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
    <Routes>
      <Route path="/" element={<Navigate to="/batches" replace />} />
      <Route path="/batches" element={loaded ? <BatchList batches={batches} jobs={jobs} openBatch={setBatchId} /> : null} />
      <Route path="/batches/new" element={<Workspace batches={batches} batchId="" setBatchId={setBatchId} updateBatch={updateBatch} refresh={() => refreshBatches()} perform={perform} onJobsChanged={refreshJobs} />} />
      <Route path="/batches/:batchId" element={loaded && !batch ? <Navigate to="/batches" replace /> : <Workspace batches={batches} batch={batch} batchId={batchId} setBatchId={setBatchId} updateBatch={updateBatch} refresh={() => refreshBatches()} perform={perform} onJobsChanged={refreshJobs} />} />
      <Route path="/jobs" element={<Jobs jobs={jobs} settings={settings} perform={perform} refresh={refreshJobs} onSettings={setSettings} showResult={showResult} />} />
      <Route path="/results" element={<Results jobs={jobs} selectedId="" setSelectedId={(id) => navigate(`/results/${encodeURIComponent(id)}`, { replace: true })} perform={perform} />} />
      <Route path="/results/:jobId" element={<Results jobs={jobs} selectedId={resultJobId} setSelectedId={(id) => navigate(`/results/${encodeURIComponent(id)}`)} perform={perform} />} />
      <Route path="*" element={<Navigate to="/batches" replace />} />
    </Routes>
  </div>;
}

function BatchList({ batches, jobs, openBatch }: { batches: BatchConfig[]; jobs: JobRecord[]; openBatch: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return batches;
    return batches.filter((batch) => `${batch.name} ${batch.id} ${batch.sourceFolder}`.toLowerCase().includes(keyword));
  }, [batches, search]);
  const totalImages = batches.reduce((sum, batch) => sum + batch.images.length, 0);
  const totalGroups = batches.reduce((sum, batch) => sum + batch.groups.length, 0);
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running").length;

  return <main className="page batch-list-page">
    <div className="page-heading batch-list-heading"><div><span className="eyebrow">BATCH LIBRARY</span><h1>批次列表</h1><p>集中查看素材批次的整理进度与任务状态。</p></div><button className="primary large" onClick={() => openBatch("")}>＋ 新建批次</button></div>
    <section className="batch-overview" aria-label="批次概览">
      <div><span>批次</span><strong>{batches.length}</strong></div><div><span>素材总数</span><strong>{totalImages}</strong></div><div><span>分组总数</span><strong>{totalGroups}</strong></div><div><span>进行中任务</span><strong>{activeJobs}</strong></div>
    </section>
    <div className="batch-list-tools"><label><span className="sr-only">搜索批次</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索批次名称、ID 或素材目录" /></label><span>共 {visible.length} 个批次</span></div>
    {!!visible.length && <div className="batch-table-wrap"><table className="batch-table">
      <thead><tr><th>批次</th><th>素材目录</th><th>素材</th><th>分组</th><th>整理进度</th><th>任务状态</th><th>更新时间</th><th><span className="sr-only">操作</span></th></tr></thead>
      <tbody>{visible.map((batch) => {
        const batchJobs = jobs.filter((job) => job.batchId === batch.id);
        const active = batchJobs.filter((job) => job.status === "queued" || job.status === "running").length;
        const review = batchJobs.filter((job) => job.status === "needs_review").length;
        const assigned = batch.images.filter((image) => image.groupId).length;
        const progress = batch.images.length ? Math.round(assigned / batch.images.length * 100) : 0;
        return <tr key={batch.id} onClick={() => openBatch(batch.id)}>
          <td><div className="batch-name-cell"><span className="batch-initial">{batch.name.trim().slice(0, 1).toUpperCase() || "B"}</span><div><strong>{batch.name}</strong><code>{batch.id}</code></div></div></td>
          <td><span className="batch-table-path" title={batch.sourceFolder}>{batch.sourceFolder}</span></td>
          <td><strong className="table-number">{batch.images.length}</strong></td>
          <td><strong className="table-number">{batch.groups.length}</strong></td>
          <td><div className="table-progress"><span>{assigned}/{batch.images.length}</span><div className="batch-progress-track"><i style={{ width: `${progress}%` }} /></div></div></td>
          <td><span className={`batch-state ${active ? "active" : review ? "review" : ""}`}>{active ? `${active} 个进行中` : review ? `${review} 个待审核` : batchJobs.length ? "已完成" : "暂无任务"}</span></td>
          <td><time dateTime={batch.updatedAt}>{formatDate(batch.updatedAt)}</time></td>
          <td><button className="table-action" onClick={(event) => { event.stopPropagation(); openBatch(batch.id); }}>进入 <span aria-hidden="true">→</span></button></td>
        </tr>;
      })}</tbody>
    </table></div>}
    {!visible.length && <div className="batch-list-empty"><span>⌕</span><h2>{batches.length ? "没有匹配的批次" : "还没有批次"}</h2><p>{batches.length ? "换个名称、ID 或目录关键字试试。" : "创建第一个批次，开始扫描和整理素材。"}</p>{!batches.length && <button className="primary" onClick={() => openBatch("")}>新建批次</button>}</div>}
  </main>;
}

interface WorkspaceProps {
  batches: BatchConfig[]; batch?: BatchConfig; batchId: string; setBatchId: (id: string) => void;
  updateBatch: (batch: BatchConfig) => void; refresh: () => Promise<void>;
  perform: <T>(action: () => Promise<T>, success?: string) => Promise<T | undefined>; onJobsChanged: () => Promise<void>;
}

function Workspace({ batches, batch, batchId, setBatchId, updateBatch, refresh, perform, onJobsChanged }: WorkspaceProps) {
  const [sourceFolder, setSourceFolder] = useState(""); const [batchName, setBatchName] = useState(""); const [importPath, setImportPath] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [groupId, setGroupId] = useState(""); const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [newGroup, setNewGroup] = useState("");
  const [defaultCategory, setDefaultCategory] = useState(""); const [defaultTags, setDefaultTags] = useState(""); const [defaultMode, setDefaultMode] = useState<BatchConfig["defaults"]["generationMode"]>("template");
  useEffect(() => { setSelected(new Set()); setGroupId(batch?.groups[0]?.id ?? ""); setFolderFilter("all"); }, [batchId]);
  useEffect(() => { setDefaultCategory(batch?.defaults.category ?? ""); setDefaultTags(batch?.defaults.tags.join(", ") ?? ""); setDefaultMode(batch?.defaults.generationMode ?? "template"); }, [batchId, batch?.updatedAt]);
  const group = batch?.groups.find((item) => item.id === groupId);
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const image of batch?.images ?? []) { const folder = assetFolder(image.relativePath); counts.set(folder, (counts.get(folder) ?? 0) + 1); }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "zh-CN"));
  }, [batch?.images]);
  const visible = useMemo(() => (batch?.images ?? []).filter((image) => {
    const matchesSearch = `${image.fileName} ${image.relativePath}`.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = filter === "all" || (filter === "unassigned" ? !image.groupId : image.groupId === filter);
    return matchesSearch && matchesGroup && (folderFilter === "all" || assetFolder(image.relativePath) === folderFilter);
  }), [batch, search, filter, folderFilter]);
  const folderSections = useMemo(() => {
    const sections = new Map<string, typeof visible>();
    for (const image of visible) { const folder = assetFolder(image.relativePath); sections.set(folder, [...(sections.get(folder) ?? []), image]); }
    return [...sections.entries()];
  }, [visible]);

  const pick = async () => { const result = await perform(() => api.pickDirectory()); if (result?.path) { setSourceFolder(result.path); if (!batchName) setBatchName(result.path.split(/[\\/]/).pop() ?? "新批次"); } };
  const create = async () => { const result = await perform(() => api.createBatch({ name: batchName, sourceFolder }), "批次已创建并完成素材扫描"); if (result) { await refresh(); setBatchId(result.id); setSourceFolder(""); setBatchName(""); } };
  const importBatch = async () => { const result = await perform(() => api.importBatch(importPath), "旧版整理文件已导入"); if (result) { await refresh(); setBatchId(result.id); } };
  const addGroup = async () => { if (!batch) return; const result = await perform(() => api.addGroup(batch.id, newGroup), "分组已创建"); if (result) { updateBatch(result); setGroupId(result.groups.at(-1)?.id ?? ""); setNewGroup(""); } };
  const assign = async (target?: string) => { if (!batch || !selected.size) return; const result = await perform(() => api.assign(batch.id, target, [...selected]), target ? "图片已加入分组" : "图片已移出分组"); if (result) { updateBatch(result); setSelected(new Set()); } };
  const run = async () => { if (!batch || !group) return; const result = await perform(() => api.createJob(batch.id, group.id), "任务已加入队列"); if (result) { await onJobsChanged(); } };
  const runAll = async () => {
    if (!batch) return;
    const runnable = batch.groups.filter((item) => item.status !== "skipped" && item.imageIds.length);
    if (!runnable.length) { await perform(async () => { throw new Error("没有包含图片的可执行分组"); }); return; }
    let queued = 0;
    for (const item of runnable) if (await perform(() => api.createJob(batch.id, item.id))) queued += 1;
    await onJobsChanged();
    if (queued) await perform(async () => queued, `已将 ${queued} 个分组加入队列`);
  };

  if (!batch) return <main className="empty-start">
    <section className="welcome-card"><div className="eyebrow">LOCAL WORKBENCH</div><h1>从一个素材文件夹开始</h1><p>扫描图片、整理分组、补充业务标签，然后按组交给仓库内 skill 批量分析。</p>
      <div className="field-row"><label>批次名称<input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="例如：七月猫猫反应图" /></label><label className="grow">素材目录<div className="input-action"><input value={sourceFolder} onChange={(e) => setSourceFolder(e.target.value)} placeholder="C:\素材\meme-july" /><button onClick={pick}>选择</button></div></label></div>
      <button className="primary large" disabled={!sourceFolder || !batchName} onClick={create}>扫描并创建批次</button>
      <details><summary>导入旧版整理文件</summary><div className="input-action"><input value={importPath} onChange={(e) => setImportPath(e.target.value)} placeholder="batch-workspace.json 或 batch-manifest.json 路径" /><button onClick={importBatch}>导入</button></div></details>
    </section>
  </main>;

  return <main className="workspace-layout">
    <aside className="batch-sidebar">
      <div className="section-title"><span>批次</span><button className="icon" onClick={() => setBatchId("")} title="新建批次">＋</button></div>
      <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>{batches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <div className="batch-summary"><strong>{batch.images.length}</strong><span>张素材</span><strong>{batch.groups.length}</strong><span>个分组</span></div>
      <details className="batch-defaults"><summary>新分组默认参数</summary><label>默认模式<select value={defaultMode} onChange={(e) => setDefaultMode(e.target.value as typeof defaultMode)}><option value="template">只生成模板</option><option value="generation_test">分析 + 真实出图</option></select></label><label>默认分类<input value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} /></label><label>默认标签<input value={defaultTags} onChange={(e) => setDefaultTags(e.target.value)} /></label><button className="full" onClick={async () => { const result = await perform(() => api.saveBatch({ ...batch, defaults: { generationMode: defaultMode, category: defaultCategory, tags: tagsFrom(defaultTags) } }), "批次默认参数已保存"); if (result) updateBatch(result); }}>保存默认参数</button></details>
      <div className="section-title"><span>分组</span></div>
      <div className="group-list">{batch.groups.map((item) => <button key={item.id} className={item.id === groupId ? "active" : ""} onClick={() => setGroupId(item.id)}><span>{item.groupName}</span><em>{item.imageIds.length}</em><small>{item.status === "ready_for_template" ? "可生成" : item.status === "skipped" ? "已跳过" : "待审核"}</small></button>)}</div>
      <div className="input-action compact"><input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="新分组目录名" onKeyDown={(e) => { if (e.key === "Enter") void addGroup(); }} /><button onClick={addGroup} disabled={!newGroup}>添加</button></div>
      <button className="ghost full" onClick={async () => { const result = await perform(() => api.rescan(batch.id), "素材目录已重新扫描"); if (result) updateBatch(result); }}>重新扫描素材</button>
      <button className="primary full" onClick={runAll}>批量生成全部分组</button>
    </aside>
    <section className="asset-panel">
      <div className="panel-toolbar"><div><h1>{batch.name}</h1><p title={batch.sourceFolder}>{batch.sourceFolder}</p></div><div className="toolbar-actions"><button className="primary" onClick={runAll}>批量生成</button><button onClick={() => setSelected(new Set(visible.map((item) => item.id)))}>全选可见</button><button onClick={() => setSelected(new Set())}>清空</button></div></div>
      <div className="filters"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索文件名或路径" /><select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} aria-label="素材文件夹"><option value="all">全部文件夹（{folders.length}）</option>{folders.map(([folder, count]) => <option value={folder} key={folder || "root"}>{folderLabel(folder)}（{count}）</option>)}</select><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="素材分组"><option value="all">全部素材</option><option value="unassigned">未分组</option>{batch.groups.map((item) => <option value={item.id} key={item.id}>{item.groupName}</option>)}</select></div>
      {selected.size > 0 && <div className="selection-bar"><strong>已选 {selected.size} 张</strong><button className="primary" disabled={!group} onClick={() => assign(group?.id)}>加入当前分组</button><button onClick={() => assign(undefined)}>移出分组</button></div>}
      <div className="asset-folders">{folderSections.map(([folder, images]) => <section className="asset-folder" key={folder || "root"}><div className="asset-folder-heading"><span className="folder-icon">⌑</span><strong title={folderLabel(folder)}>{folderLabel(folder)}</strong><em>{images.length} 张</em><button onClick={() => setSelected((current) => new Set([...current, ...images.map((image) => image.id)]))}>选择此文件夹</button></div><div className="asset-grid">{images.map((image) => { const assigned = batch.groups.find((item) => item.id === image.groupId); return <button key={image.id} className={`asset-card ${selected.has(image.id) ? "selected" : ""}`} onClick={() => setSelected((current) => { const next = new Set(current); next.has(image.id) ? next.delete(image.id) : next.add(image.id); return next; })}><div className="checkmark">{selected.has(image.id) ? "✓" : ""}</div><img loading="lazy" src={`/api/files?path=${encodeURIComponent(image.sourcePath)}`} alt={image.fileName} /><div><strong title={image.fileName}>{image.fileName}</strong><small>{assigned?.groupName ?? "未分组"}</small></div></button>; })}</div></section>)}</div>
      {!visible.length && <div className="empty-inline">没有符合条件的图片</div>}
    </section>
    <aside className="config-panel">{group ? <GroupEditor key={`${batch.id}-${group.id}-${group.imageIds.length}`} batch={batch} group={group} updateBatch={updateBatch} perform={perform} run={run} /> : <div className="empty-inline">创建或选择一个分组后配置任务</div>}</aside>
  </main>;
}

function GroupEditor({ batch, group, updateBatch, perform, run }: { batch: BatchConfig; group: GroupConfig; updateBatch: (value: BatchConfig) => void; perform: WorkspaceProps["perform"]; run: () => Promise<void> }) {
  const [draft, setDraft] = useState<GroupConfig>(() => structuredClone(group));
  const patch = <K extends keyof GroupConfig>(key: K, value: GroupConfig[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => { const result = await perform(() => api.saveGroup(batch.id, draft), "分组配置已保存"); if (result) updateBatch(result); return Boolean(result); };
  const remove = async () => { if (!confirm(`确定删除分组“${group.groupName}”？素材不会被删除。`)) return; const result = await perform(() => api.deleteGroup(batch.id, group.id), "分组已删除"); if (result) updateBatch(result); };
  return <div className="editor"><div className="editor-heading"><div><span className="eyebrow">GROUP CONFIG</span><h2>分组配置</h2></div><span className={`status-dot ${draft.status}`}>{draft.status}</span></div>
    <label>分组目录名<input value={draft.groupName} onChange={(e) => patch("groupName", e.target.value)} /></label>
    <div className="field-row"><label>状态<select value={draft.status} onChange={(e) => patch("status", e.target.value as GroupConfig["status"])}><option value="ready_for_template">ready_for_template</option><option value="needs_review">needs_review</option><option value="skipped">skipped</option></select></label><label>生成模式<select value={draft.generationMode} onChange={(e) => patch("generationMode", e.target.value as GroupConfig["generationMode"])}><option value="template">只生成模板</option><option value="generation_test">分析 + 真实出图</option></select></label></div>
    <label>分类<input value={draft.category} onChange={(e) => patch("category", e.target.value)} placeholder="reaction/money" /></label>
    <label>标签<input value={draft.tags.join(", ")} onChange={(e) => patch("tags", tagsFrom(e.target.value))} placeholder="猫, 反应图, 没钱" /></label>
    <label>模板机制<textarea value={draft.templateMechanism} onChange={(e) => patch("templateMechanism", e.target.value)} placeholder="描述模板成立的业务机制" /></label>
    <fieldset><legend>参考图角色</legend>{(["template_reference", "style_reference", "composition_reference", "identity_reference"] as const).map((key) => <label className="checkbox" key={key}><input type="checkbox" checked={draft.referenceConfig[key]} onChange={(e) => patch("referenceConfig", { ...draft.referenceConfig, [key]: e.target.checked })} />{key}</label>)}</fieldset>
    <div className="field-row"><label>参考依赖<select value={draft.referenceDependencyLevel} onChange={(e) => patch("referenceDependencyLevel", e.target.value as GroupConfig["referenceDependencyLevel"])}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label><label>测试建议<select value={draft.testModeRecommendation} onChange={(e) => patch("testModeRecommendation", e.target.value as GroupConfig["testModeRecommendation"])}><option value="reference_aware_required">reference aware required</option><option value="reference_aware_preferred">reference aware preferred</option><option value="prompt_mode_allowed">prompt mode allowed</option></select></label></div>
    <label>业务备注<textarea value={draft.notes} onChange={(e) => patch("notes", e.target.value)} placeholder="需要 Agent 特别注意的内容" /></label>
    <div className="editor-actions"><button onClick={save}>保存配置</button><button onClick={async () => { if (await save()) await perform(() => api.organize(batch.id, group.id), "图片已复制到分组目录"); }}>整理到文件夹</button></div>
    <button className="primary full run-button" disabled={!group.imageIds.length || draft.status === "skipped"} onClick={async () => { if (await save()) await run(); }}>开始生成 · {group.imageIds.length} 张</button>
    <button className="danger-link" onClick={remove}>删除当前分组</button>
  </div>;
}

function Jobs({ jobs, settings, perform, refresh, onSettings, showResult }: { jobs: JobRecord[]; settings: AdminSettings; perform: WorkspaceProps["perform"]; refresh: () => Promise<void>; onSettings: (value: AdminSettings) => void; showResult: (id: string) => void }) {
  return <main className="page"><div className="page-heading"><div><span className="eyebrow">JOB QUEUE</span><h1>任务中心</h1><p>任务按分组执行，状态来自 Codex JSONL 事件与本地 validator。</p></div><label className="concurrency">并发任务<select value={settings.concurrency} onChange={async (e) => { const result = await perform(() => api.saveSettings({ concurrency: Number(e.target.value) as 1 | 2 | 3 }), "并发设置已更新"); if (result) onSettings(result); }}><option value="1">1（推荐）</option><option value="2">2</option><option value="3">3</option></select></label></div>
    <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}><div className={`job-status ${job.status}`}><span />{statusLabel[job.status]}</div><div className="job-main"><div><h2>{job.groupName}</h2><small>{job.id.slice(0, 8)} · {new Date(job.createdAt).toLocaleString("zh-CN")}</small></div><div className="phase"><span>{job.phase}</span><div className="phase-line"><i className={job.status === "running" ? "moving" : ""} /></div></div><p>{job.error ?? job.lastEvent}</p></div><div className="job-meta"><span>耗时<strong>{duration(job)}</strong></span><span>校验<strong>{job.validatorResults.length ? `${job.validatorResults.filter((item) => item.passed).length}/${job.validatorResults.length}` : "—"}</strong></span><div className="job-actions">{(job.status === "queued" || job.status === "running") && <button onClick={async () => { await perform(() => api.cancelJob(job.id), "任务已取消"); await refresh(); }}>取消</button>}{["failed", "cancelled", "interrupted"].includes(job.status) && <button onClick={async () => { await perform(() => api.retryJob(job.id), "重试任务已排队"); await refresh(); }}>重试</button>}{["succeeded", "needs_review", "failed"].includes(job.status) && <button className="primary" onClick={() => showResult(job.id)}>查看结果</button>}</div></div></article>)}</div>
    {!jobs.length && <div className="empty-page"><h2>还没有任务</h2><p>在“素材与批次”中选择分组并开始生成。</p></div>}
  </main>;
}

function Results({ jobs, selectedId, setSelectedId, perform }: { jobs: JobRecord[]; selectedId: string; setSelectedId: (id: string) => void; perform: WorkspaceProps["perform"] }) {
  const candidates = jobs.filter((job) => ["succeeded", "needs_review", "failed"].includes(job.status)); const selected = candidates.find((job) => job.id === selectedId) ?? candidates[0];
  const [files, setFiles] = useState<ResultFile[]>([]); const [file, setFile] = useState<ResultFile>(); const [content, setContent] = useState("");
  useEffect(() => { if (!selected) return; setSelectedId(selected.id); void api.files(selected.id).then((data) => { setFiles(data); const preferred = data.find((item) => item.name === "meme-template.json") ?? data[0]; setFile(preferred); }).catch(() => setFiles([])); }, [selected?.id]);
  useEffect(() => { if (!file || file.kind === "image") { setContent(""); return; } void fetch(`/api/files?path=${encodeURIComponent(file.absolutePath)}`).then((response) => response.text()).then(setContent); }, [file?.absolutePath]);
  if (!selected) return <main className="empty-page"><h2>暂无可审核结果</h2><p>任务完成后，产物会集中显示在这里。</p></main>;
  const images = files.filter((item) => item.kind === "image");
  return <main className="results-layout"><aside className="result-jobs"><div className="section-title">最近结果</div>{candidates.map((job) => <button className={job.id === selected.id ? "active" : ""} key={job.id} onClick={() => setSelectedId(job.id)}><strong>{job.groupName}</strong><small>{statusLabel[job.status]}</small></button>)}</aside><section className="result-main"><div className="page-heading compact-heading"><div><span className="eyebrow">RESULT REVIEW</span><h1>{selected.groupName}</h1><p>{selected.lastEvent}</p></div><button onClick={() => perform(() => api.openFolder(selected.resultDirectory), "已打开结果文件夹")}>打开结果文件夹</button></div>
    <div className="validation-strip">{selected.validatorResults.map((result, index) => <span className={result.passed ? "pass" : "fail"} key={`${result.file}-${index}`}>{result.validator}: {result.passed ? "PASS" : "FAIL"}</span>)}{!selected.validatorResults.length && <span>暂无 validator 结果</span>}</div>
    {!!images.length && <div className="result-gallery">{images.map((image) => <button key={image.absolutePath} onClick={() => setFile(image)} className={file?.absolutePath === image.absolutePath ? "active" : ""}><img src={image.url} alt={image.name} /><small>{image.relativePath}</small></button>)}</div>}
    <div className="file-review"><div className="file-list">{files.filter((item) => item.kind !== "image").map((item) => <button key={item.absolutePath} className={file?.absolutePath === item.absolutePath ? "active" : ""} onClick={() => setFile(item)}><span>{item.kind === "json" ? "{}" : "MD"}</span><div><strong>{item.name}</strong><small>{item.relativePath}</small></div></button>)}</div><div className="file-preview">{file?.kind === "image" ? <img src={file.url} alt={file.name} /> : <pre>{content || "选择文件查看内容"}</pre>}</div></div>
  </section></main>;
}

export default App;
