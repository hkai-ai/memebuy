import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, matchPath, useLocation, useNavigate } from "react-router-dom";
import { compareImageAssets, deduplicateImageAssets, imageAssetFolder, imageAssetOrigin, sourceImageIdsForFolders } from "../shared/assets";
import type { AdminSettings, BatchConfig, FolderTemplateStatus, GroupConfig, ImageAssetSort, JobRecord, JobStatus, OssAssetState, OssJobAssetStatus, ResultFile, TagCatalog, TagDefinition } from "../shared/types";
import { api } from "./api";

const statusLabel: Record<JobStatus, string> = { queued: "排队中", running: "执行中", succeeded: "已完成", needs_review: "待审核", failed: "失败", cancelled: "已取消", interrupted: "已中断" };
const originLabel = { source: "原图 · Source", generated: "生成图 · Output", other: "其他" } as const;
const tagGroups = ["画风·笔触", "动漫·卡通", "国风·东方", "工艺·材质", "版式·形态", "复古·年代", "实拍·摄影", "3D·数字", "萌趣", "暖感", "态度", "氛围"] as const;
const ossStateLabel: Record<OssAssetState, string> = { not_uploaded: "原图未上传", partial: "部分已上传", uploaded: "原图已上传", object_missing: "OSS 对象缺失", local_missing: "本地原图缺失", invalid: "JSON/URL 异常", config_missing: "OSS 未配置" };

function tagsFrom(value: string) { return [...new Set(value.split(/[,，]/).map((item) => item.trim()).filter(Boolean))]; }
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
  const [tagCatalog, setTagCatalog] = useState<TagCatalog>({ schemaVersion: "1.1", updatedAt: "", tags: [] });
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

  useEffect(() => { void Promise.all([api.batches(), api.jobs(), api.settings(), api.tagCatalog()]).then(([batchData, jobData, settingData, catalogData]) => { setBatches(batchData); setJobs(jobData); setSettings(settingData); setTagCatalog(catalogData); }).catch((reason) => setError(`无法连接本地 API：${reason.message}`)).finally(() => setLoaded(true)); }, []);
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
        <NavLink to="/tags">标签词库 <span className="count">{tagCatalog.tags.filter((tag) => tag.enabled).length}</span></NavLink>
      </nav>
      <div className="local-badge"><span /> localhost</div>
    </header>
    {(error || notice) && <div className={`toast ${error ? "danger" : ""}`} role="status">{error || notice}<button onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
    <Routes>
      <Route path="/" element={<Navigate to="/batches" replace />} />
      <Route path="/batches" element={loaded ? <BatchList batches={batches} jobs={jobs} openBatch={setBatchId} /> : null} />
      <Route path="/batches/new" element={<Workspace batches={batches} batchId="" tagCatalog={tagCatalog} setBatchId={setBatchId} updateBatch={updateBatch} refresh={() => refreshBatches()} perform={perform} onJobsChanged={refreshJobs} />} />
      <Route path="/batches/:batchId" element={loaded && !batch ? <Navigate to="/batches" replace /> : <Workspace batches={batches} batch={batch} batchId={batchId} tagCatalog={tagCatalog} setBatchId={setBatchId} updateBatch={updateBatch} refresh={() => refreshBatches()} perform={perform} onJobsChanged={refreshJobs} />} />
      <Route path="/jobs" element={<Jobs jobs={jobs} settings={settings} perform={perform} refresh={refreshJobs} onSettings={setSettings} showResult={showResult} />} />
      <Route path="/results" element={<Results jobs={jobs} selectedId="" setSelectedId={(id) => navigate(`/results/${encodeURIComponent(id)}`, { replace: true })} perform={perform} />} />
      <Route path="/results/:jobId" element={<Results jobs={jobs} selectedId={resultJobId} setSelectedId={(id) => navigate(`/results/${encodeURIComponent(id)}`)} perform={perform} />} />
      <Route path="/tags" element={<TagCatalogPage catalog={tagCatalog} setCatalog={setTagCatalog} perform={perform} />} />
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
  batches: BatchConfig[]; batch?: BatchConfig; batchId: string; tagCatalog: TagCatalog; setBatchId: (id: string) => void;
  updateBatch: (batch: BatchConfig) => void; refresh: () => Promise<void>;
  perform: <T>(action: () => Promise<T>, success?: string) => Promise<T | undefined>; onJobsChanged: () => Promise<void>;
}

function Workspace({ batches, batch, batchId, tagCatalog, setBatchId, updateBatch, refresh, perform, onJobsChanged }: WorkspaceProps) {
  const [sourceFolder, setSourceFolder] = useState(""); const [batchName, setBatchName] = useState(""); const [importPath, setImportPath] = useState("");
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set()); const [groupId, setGroupId] = useState(""); const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all");
  const [showOutput, setShowOutput] = useState(false); const [assetSort, setAssetSort] = useState<ImageAssetSort>("time_desc");
  const [folderTemplates, setFolderTemplates] = useState<FolderTemplateStatus[]>([]); const [folderTemplatesLoaded, setFolderTemplatesLoaded] = useState(false); const [folderTemplatesError, setFolderTemplatesError] = useState(""); const [previewTemplate, setPreviewTemplate] = useState<FolderTemplateStatus>();
  const [newGroup, setNewGroup] = useState("");
  const [defaultCategory, setDefaultCategory] = useState(""); const [defaultTags, setDefaultTags] = useState(""); const [defaultMode, setDefaultMode] = useState<BatchConfig["defaults"]["generationMode"]>("template");
  useEffect(() => { setSelectedFolders(new Set()); setGroupId(batch?.groups[0]?.id ?? ""); setShowOutput(false); setPreviewTemplate(undefined); }, [batchId]);
  useEffect(() => { if (!selectedFolders.size) setPreviewTemplate(undefined); }, [selectedFolders]);
  useEffect(() => {
    if (!batchId) return;
    setFolderTemplatesLoaded(false); setFolderTemplatesError("");
    void api.folderTemplates(batchId).then(setFolderTemplates).catch((reason) => { setFolderTemplates([]); setFolderTemplatesError(reason instanceof Error ? reason.message : "模板检查失败"); }).finally(() => setFolderTemplatesLoaded(true));
  }, [batchId, batch?.updatedAt]);
  useEffect(() => { setDefaultCategory(batch?.defaults.category ?? ""); setDefaultTags(batch?.defaults.tags.join(", ") ?? ""); setDefaultMode(batch?.defaults.generationMode ?? "template"); }, [batchId, batch?.updatedAt]);
  const group = batch?.groups.find((item) => item.id === groupId);
  const groupNameById = useMemo(() => new Map((batch?.groups ?? []).map((item) => [item.id, item.groupName])), [batch?.groups]);
  const displayImages = useMemo(() => deduplicateImageAssets(batch?.images ?? []), [batch?.images]);
  const originCounts = useMemo(() => {
    const counts = { source: 0, generated: 0, other: 0 };
    for (const image of displayImages) counts[imageAssetOrigin(image)] += 1;
    return counts;
  }, [displayImages]);
  const folderAssetsByName = useMemo(() => {
    const assets = new Map<string, typeof displayImages>();
    for (const image of displayImages) { const folder = imageAssetFolder(image.relativePath); const current = assets.get(folder); if (current) current.push(image); else assets.set(folder, [image]); }
    return assets;
  }, [displayImages]);
  const templateByFolder = useMemo(() => new Map(folderTemplates.map((item) => [item.folder, item])), [folderTemplates]);
  const visible = useMemo(() => displayImages.filter((image) => {
    const matchesSearch = `${image.fileName} ${image.relativePath}`.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = filter === "all" || (filter === "unassigned" ? !image.groupId : image.groupId === filter);
    const matchesOutputVisibility = showOutput || imageAssetOrigin(image) !== "generated";
    return matchesSearch && matchesGroup && matchesOutputVisibility;
  }), [displayImages, search, filter, showOutput]);
  const folderSections = useMemo(() => {
    const sections = new Map<string, typeof visible>();
    for (const image of visible) { const folder = imageAssetFolder(image.relativePath); sections.set(folder, [...(sections.get(folder) ?? []), image]); }
    const entries = [...sections.entries()].map(([folder, images]) => [folder, images.sort((a, b) => compareImageAssets(a, b, assetSort))] as const);
    return entries.sort(([folderA, imagesA], [folderB, imagesB]) => {
      if (assetSort === "name_asc") return folderA.localeCompare(folderB, "zh-CN");
      const latest = (images: typeof visible) => Math.max(...images.map((image) => Date.parse(image.modifiedAt ?? "")).filter(Number.isFinite), 0);
      const timeOrder = latest(imagesA) - latest(imagesB);
      return timeOrder ? (assetSort === "time_desc" ? -timeOrder : timeOrder) : folderA.localeCompare(folderB, "zh-CN");
    });
  }, [visible, assetSort]);

  const pick = async () => { const result = await perform(() => api.pickDirectory()); if (result?.path) { setSourceFolder(result.path); if (!batchName) setBatchName(result.path.split(/[\\/]/).pop() ?? "新批次"); } };
  const create = async () => { const result = await perform(() => api.createBatch({ name: batchName, sourceFolder }), "批次已创建并完成素材扫描"); if (result) { await refresh(); setBatchId(result.id); setSourceFolder(""); setBatchName(""); } };
  const importBatch = async () => { const result = await perform(() => api.importBatch(importPath), "旧版整理文件已导入"); if (result) { await refresh(); setBatchId(result.id); } };
  const addGroup = async () => { if (!batch) return; const result = await perform(() => api.addGroup(batch.id, newGroup), "分组已创建"); if (result) { updateBatch(result); setGroupId(result.groups.at(-1)?.id ?? ""); setNewGroup(""); } };
  const assign = async (target?: string) => {
    if (!batch || !selectedFolders.size) return;
    const imageIds = sourceImageIdsForFolders(batch.images, selectedFolders);
    const result = await perform(() => api.assign(batch.id, target, imageIds), target ? "文件夹原图已加入分组" : "文件夹原图已移出分组");
    if (result) { updateBatch(result); setSelectedFolders(new Set()); }
  };
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
      <details className="batch-defaults"><summary>新分组默认参数</summary><label>默认模式<select value={defaultMode} onChange={(e) => setDefaultMode(e.target.value as typeof defaultMode)}><option value="template">只生成模板</option><option value="generation_test">分析 + 真实出图</option></select></label><label>默认自由标签<input value={defaultTags} onChange={(e) => setDefaultTags(e.target.value)} /></label><small>常用标签可到“标签词库”维护，并在分组配置中勾选。</small><button className="full" onClick={async () => { const result = await perform(() => api.saveBatch({ ...batch, defaults: { generationMode: defaultMode, category: defaultCategory, tags: tagsFrom(defaultTags) } }), "批次默认参数已保存"); if (result) updateBatch(result); }}>保存默认参数</button></details>
      <div className="section-title"><span>分组</span></div>
      <div className="group-list">{batch.groups.map((item) => <button key={item.id} className={item.id === groupId ? "active" : ""} onClick={() => setGroupId(item.id)}><span>{item.groupName}</span><em>{item.imageIds.length}</em><small>{item.status === "ready_for_template" ? "可生成" : item.status === "skipped" ? "已跳过" : "待审核"}</small></button>)}</div>
      <div className="input-action compact"><input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="新分组目录名" onKeyDown={(e) => { if (e.key === "Enter") void addGroup(); }} /><button onClick={addGroup} disabled={!newGroup}>添加</button></div>
      <button className="ghost full" onClick={async () => { const result = await perform(() => api.rescan(batch.id), "素材目录已重新扫描"); if (result) updateBatch(result); }}>重新扫描素材</button>
      <button className="primary full" onClick={runAll}>批量生成全部分组</button>
    </aside>
    <section className="asset-panel">
      <div className="panel-toolbar"><div><h1>{batch.name}</h1><p title={batch.sourceFolder}>{batch.sourceFolder}</p></div><div className="toolbar-actions"><button className="primary" onClick={runAll}>批量生成</button><button onClick={() => setSelectedFolders(new Set(folderSections.filter(([, images]) => images.some((image) => imageAssetOrigin(image) === "source")).map(([folder]) => folder)))}>全选可见文件夹</button><button onClick={() => setSelectedFolders(new Set())}>清空</button></div></div>
      <div className="filters"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索文件名或路径" /><select value={assetSort} onChange={(e) => setAssetSort(e.target.value as ImageAssetSort)} aria-label="素材排序"><option value="time_desc">时间：最新优先</option><option value="time_asc">时间：最早优先</option><option value="name_asc">名称：A–Z</option></select><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="素材分组"><option value="all">全部分组</option><option value="unassigned">未分组</option>{batch.groups.map((item) => <option value={item.id} key={item.id}>{item.groupName}</option>)}</select><label className="checkbox output-toggle"><input type="checkbox" checked={showOutput} onChange={(e) => setShowOutput(e.target.checked)} />显示 output（{originCounts.generated}）</label></div>
      {selectedFolders.size > 0 && <div className="selection-bar"><strong>已选 {selectedFolders.size} 个文件夹</strong><span>分析时仅使用原图 Source</span><button className="primary" disabled={!group} onClick={() => assign(group?.id)}>加入当前分组</button><button onClick={() => assign(undefined)}>移出分组</button></div>}
      <div className="asset-folders">{folderSections.map(([folder, images]) => { const folderAssets = folderAssetsByName.get(folder) ?? []; const sourceCount = folderAssets.filter((image) => imageAssetOrigin(image) === "source").length; const generatedCount = folderAssets.filter((image) => imageAssetOrigin(image) === "generated").length; const templateStatus = templateByFolder.get(folder); const isSelected = selectedFolders.has(folder); const toggleFolder = () => { if (!sourceCount) return; setSelectedFolders((current) => { const next = new Set(current); next.has(folder) ? next.delete(folder) : next.add(folder); return next; }); }; return <section className={`asset-folder ${isSelected ? "selected" : ""}`} key={folder || "root"}><div className="asset-folder-heading"><label className={`folder-select ${!sourceCount ? "disabled" : ""}`}><input type="checkbox" checked={isSelected} disabled={!sourceCount} onChange={toggleFolder} /><span className="folder-icon">⌑</span><strong title={folderLabel(folder)}>{folderLabel(folder)}</strong></label><em>{folderAssets.length} 张</em>{sourceCount > 0 ? <em className="origin-count source">{sourceCount} 原图</em> : <em className="origin-count missing">无原图</em>}{generatedCount > 0 && <em className="origin-count generated">{generatedCount} 生成图</em>}{templateStatus?.exists && <button className="template-present" title="点击预览 meme-template.json" onClick={() => { setSelectedFolders(new Set([folder])); setPreviewTemplate(templateStatus); }}>✓ meme-template.json</button>}<button disabled={!sourceCount} onClick={toggleFolder}>{isSelected ? "取消选择" : "选择此文件夹"}</button></div><div className="asset-grid">{images.map((image) => { const origin = imageAssetOrigin(image); return <div key={image.id} className="asset-card"><span className={`asset-origin ${origin}`}>{originLabel[origin]}</span><img loading="lazy" src={`/api/files?path=${encodeURIComponent(image.sourcePath)}`} alt={`${originLabel[origin]}：${image.fileName}`} /><div><strong title={image.fileName}>{image.fileName}</strong><small>{origin === "source" ? image.groupId ? groupNameById.get(image.groupId) ?? "未分组" : "未分组" : "仅预览，不参与分析"}</small></div></div>; })}</div></section>; })}</div>
      {!visible.length && <div className="empty-inline">没有符合条件的图片</div>}
    </section>
    <aside className="config-panel">{selectedFolders.size ? <FolderInspector folders={[...selectedFolders]} assetsByFolder={folderAssetsByName} templateByFolder={templateByFolder} templatesLoaded={folderTemplatesLoaded} templatesError={folderTemplatesError} group={group} assign={assign} previewTemplate={previewTemplate} setPreviewTemplate={setPreviewTemplate} /> : group ? <GroupEditor key={`${batch.id}-${group.id}-${group.imageIds.length}`} batch={batch} group={group} tagCatalog={tagCatalog} updateBatch={updateBatch} perform={perform} run={run} /> : <div className="empty-inline">选择文件夹查看检查结果，或创建分组配置生成任务</div>}</aside>
  </main>;
}

function FolderInspector({ folders, assetsByFolder, templateByFolder, templatesLoaded, templatesError, group, assign, previewTemplate, setPreviewTemplate }: { folders: string[]; assetsByFolder: Map<string, BatchConfig["images"]>; templateByFolder: Map<string, FolderTemplateStatus>; templatesLoaded: boolean; templatesError: string; group?: GroupConfig; assign: (target?: string) => Promise<void>; previewTemplate?: FolderTemplateStatus; setPreviewTemplate: (value?: FolderTemplateStatus) => void }) {
  const [content, setContent] = useState(""); const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    if (!previewTemplate?.absolutePath) { setContent(""); setPreviewError(""); return; }
    setContent(""); setPreviewError("");
    void fetch(`/api/files?path=${encodeURIComponent(previewTemplate.absolutePath)}`).then(async (response) => { if (!response.ok) throw new Error("文件读取失败"); const text = await response.text(); try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } }).then(setContent).catch((reason) => setPreviewError(reason instanceof Error ? reason.message : String(reason)));
  }, [previewTemplate?.absolutePath]);
  const sourceCount = folders.reduce((sum, folder) => sum + (assetsByFolder.get(folder) ?? []).filter((image) => imageAssetOrigin(image) === "source").length, 0);
  const generatedCount = folders.reduce((sum, folder) => sum + (assetsByFolder.get(folder) ?? []).filter((image) => imageAssetOrigin(image) === "generated").length, 0);
  const templateCount = folders.filter((folder) => templateByFolder.get(folder)?.exists).length;
  return <div className="folder-inspector"><div className="editor-heading"><div><span className="eyebrow">FOLDER CHECK</span><h2>文件夹检查</h2></div><span className="folder-count">{folders.length} 个</span></div>
    <p className="inspector-help">这里检查所选素材文件夹；任务参数属于“分组”，清空选择后可继续配置。</p>
    <div className="folder-stats"><div><strong>{sourceCount}</strong><span>原图</span></div><div><strong>{generatedCount}</strong><span>生成图</span></div><div><strong>{templatesLoaded && !templatesError ? `${templateCount}/${folders.length}` : "…"}</strong><span>已有模板</span></div></div>
    {templatesError && <div className="template-check-error">模板检查失败：{templatesError}</div>}
    <div className="folder-check-list">{folders.map((folder) => { const status = templateByFolder.get(folder); const statusText = !templatesLoaded ? "… 正在检查 meme-template.json" : templatesError ? "! 暂时无法确认模板" : status?.exists ? "✓ 已有 meme-template.json" : "— 未找到 meme-template.json"; return <article key={folder || "root"}><div><strong title={folderLabel(folder)}>{folderLabel(folder)}</strong><span className={`template-status ${!templatesLoaded ? "checking" : status?.exists ? "exists" : "missing"}`}>{statusText}</span></div>{status?.exists && <button onClick={() => setPreviewTemplate(status)}>{previewTemplate?.absolutePath === status.absolutePath ? "正在预览" : "查看预览"}</button>}</article>; })}</div>
    <div className="folder-actions"><button className="primary full" disabled={!group} onClick={() => assign(group?.id)}>{group ? `加入分组：${group.groupName}` : "请先创建分组"}</button><button className="full" onClick={() => assign(undefined)}>移出当前分组</button></div>
    {previewTemplate?.absolutePath && <section className="template-preview"><div><strong>meme-template.json</strong><button aria-label="关闭预览" onClick={() => setPreviewTemplate(undefined)}>×</button></div><small title={previewTemplate.absolutePath}>{previewTemplate.folder || "根目录"}</small><pre>{previewError || content || "正在读取…"}</pre></section>}
  </div>;
}

function GroupEditor({ batch, group, tagCatalog, updateBatch, perform, run }: { batch: BatchConfig; group: GroupConfig; tagCatalog: TagCatalog; updateBatch: (value: BatchConfig) => void; perform: WorkspaceProps["perform"]; run: () => Promise<void> }) {
  const [draft, setDraft] = useState<GroupConfig>(() => ({ ...structuredClone(group), tagIds: group.tagIds ?? [...new Set([...(group.operatorTagIds ?? []), ...(group.templateTagIds ?? [])])], uploadSourceImages: group.uploadSourceImages ?? false }));
  const patch = <K extends keyof GroupConfig>(key: K, value: GroupConfig[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleTag = (id: string) => patch("tagIds", draft.tagIds.includes(id) ? draft.tagIds.filter((item) => item !== id) : [...draft.tagIds, id]);
  const save = async () => { const result = await perform(() => api.saveGroup(batch.id, draft), "分组配置已保存"); if (result) updateBatch(result); return Boolean(result); };
  const remove = async () => { if (!confirm(`确定删除分组“${group.groupName}”？素材不会被删除。`)) return; const result = await perform(() => api.deleteGroup(batch.id, group.id), "分组已删除"); if (result) updateBatch(result); };
  return <div className="editor"><div className="editor-heading"><div><span className="eyebrow">GROUP CONFIG</span><h2>分组配置</h2></div><span className={`status-dot ${draft.status}`}>{draft.status}</span></div>
    <label>分组目录名<input value={draft.groupName} onChange={(e) => patch("groupName", e.target.value)} /></label>
    <div className="field-row"><label>状态<select value={draft.status} onChange={(e) => patch("status", e.target.value as GroupConfig["status"])}><option value="ready_for_template">ready_for_template</option><option value="needs_review">needs_review</option><option value="skipped">skipped</option></select></label><label>生成模式<select value={draft.generationMode} onChange={(e) => patch("generationMode", e.target.value as GroupConfig["generationMode"])}><option value="template">只生成模板</option><option value="generation_test">分析 + 真实出图</option></select></label></div>
    <fieldset className="tag-picker"><legend>标签</legend><p>选择这个分组需要保留的风格或情绪标签；组名只用于整理，不会写入模板 tags。</p><div>{tagCatalog.tags.filter((tag) => tag.enabled || draft.tagIds.includes(tag.id)).map((tag) => <label className={`tag-choice ${!tag.enabled ? "disabled" : ""}`} key={tag.id}><input type="checkbox" checked={draft.tagIds.includes(tag.id)} disabled={!tag.enabled && !draft.tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} /><span>{tag.label}</span><small>{tag.group}{!tag.enabled ? " · 已停用" : ""}</small></label>)}</div>{!tagCatalog.tags.length && <small>标签词库还是空的，可先到顶部“标签词库”添加。</small>}</fieldset>
    <details><summary>补充自由标签</summary><label>标签<input value={draft.tags.join(", ")} onChange={(e) => patch("tags", tagsFrom(e.target.value))} placeholder="多个标签用逗号分隔" /></label></details>
    <label>模板机制<textarea value={draft.templateMechanism} onChange={(e) => patch("templateMechanism", e.target.value)} placeholder="描述模板成立的业务机制" /></label>
    <fieldset><legend>参考图角色</legend>{(["template_reference", "style_reference", "composition_reference", "identity_reference"] as const).map((key) => <label className="checkbox" key={key}><input type="checkbox" checked={draft.referenceConfig[key]} onChange={(e) => patch("referenceConfig", { ...draft.referenceConfig, [key]: e.target.checked })} />{key}</label>)}</fieldset>
    <div className="field-row"><label>参考依赖<select value={draft.referenceDependencyLevel} onChange={(e) => patch("referenceDependencyLevel", e.target.value as GroupConfig["referenceDependencyLevel"])}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label><label>测试建议<select value={draft.testModeRecommendation} onChange={(e) => patch("testModeRecommendation", e.target.value as GroupConfig["testModeRecommendation"])}><option value="reference_aware_required">reference aware required</option><option value="reference_aware_preferred">reference aware preferred</option><option value="prompt_mode_allowed">prompt mode allowed</option></select></label></div>
    <label className="checkbox oss-agent-option"><input type="checkbox" checked={draft.uploadSourceImages} onChange={(event) => patch("uploadSourceImages", event.target.checked)} /><span><strong>Agent 完成后上传 source image 到 OSS</strong><small>显式授权 Agent 在本地 validator 通过后上传原图，并将受控 URL 回写 meme-template.json。</small></span></label>
    <label>业务备注<textarea value={draft.notes} onChange={(e) => patch("notes", e.target.value)} placeholder="需要 Agent 特别注意的内容" /></label>
    <div className="editor-actions"><button onClick={save}>保存配置</button><button onClick={async () => { if (await save()) await perform(() => api.organize(batch.id, group.id), "图片已复制到分组目录"); }}>整理到文件夹</button></div>
    <button className="primary full run-button" disabled={!group.imageIds.length || draft.status === "skipped"} onClick={async () => { if (await save()) await run(); }}>开始生成 · {group.imageIds.length} 张</button>
    <button className="danger-link" onClick={remove}>删除当前分组</button>
  </div>;
}

function TagCatalogPage({ catalog, setCatalog, perform }: { catalog: TagCatalog; setCatalog: (value: TagCatalog) => void; perform: WorkspaceProps["perform"] }) {
  const [draft, setDraft] = useState<TagCatalog>(() => structuredClone(catalog));
  const [form, setForm] = useState({ label: "", group: tagGroups[0] as string, aliases: "", description: "" });
  useEffect(() => setDraft(structuredClone(catalog)), [catalog.updatedAt]);
  const add = () => {
    const label = form.label.trim(); if (!label) return;
    const id = `tag.${Date.now().toString(36)}`;
    setDraft((current) => ({ ...current, tags: [...current.tags, { id, label, group: form.group, aliases: tagsFrom(form.aliases), enabled: true, ...(form.description.trim() ? { description: form.description.trim() } : {}) }] }));
    setForm((current) => ({ ...current, label: "", aliases: "", description: "" }));
  };
  const save = async () => { const result = await perform(() => api.saveTagCatalog({ ...draft, updatedAt: new Date().toISOString() }), "标签词库已保存，后续任务将读取新版本"); if (result) setCatalog(result); };
  const patchTag = (id: string, values: Partial<TagDefinition>) => setDraft((current) => ({ ...current, tags: current.tags.map((tag) => tag.id === id ? { ...tag, ...values } : tag) }));
  const groups = [...tagGroups, ...draft.tags.map((tag) => tag.group).filter((group, index, values) => !tagGroups.includes(group as typeof tagGroups[number]) && values.indexOf(group) === index)];
  return <main className="page tag-catalog-page"><div className="page-heading"><div><span className="eyebrow">TAG CATALOG</span><h1>标签词库</h1><p>按风格与情绪维度整理普通 tags；组名只用于展示，不会作为标签写入模板。</p></div><button className="primary large" onClick={save}>保存词库</button></div>
    <section className="tag-create-card"><h2>新增标签</h2><div className="tag-create-grid"><label>标签名称<input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="输入一个具体标签" /></label><label>分组<select value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })}>{tagGroups.map((group) => <option value={group} key={group}>{group}</option>)}</select></label><label>别名<input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} placeholder="逗号分隔，可不填" /></label><label>说明<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="适用边界，可不填" /></label><button className="primary" disabled={!form.label.trim()} onClick={add}>加入词库</button></div></section>
    <div className="tag-catalog-groups">{groups.map((group) => { const tags = draft.tags.filter((tag) => tag.group === group); return <section key={group}><div className="tag-group-heading"><div><h2>{group}</h2><span>{tags.length} 个</span></div></div><div className="tag-definition-list">{tags.map((tag) => <article className={!tag.enabled ? "disabled" : ""} key={tag.id}><div><strong>{tag.label}</strong><code>{tag.id}</code><small>{tag.description || (tag.aliases.length ? `别名：${tag.aliases.join("、")}` : "普通标签")}</small></div><button onClick={() => patchTag(tag.id, { enabled: !tag.enabled })}>{tag.enabled ? "停用" : "启用"}</button></article>)}</div></section>; })}</div>
  </main>;
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
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set()); const [tagInput, setTagInput] = useState(""); const [manualTagInput, setManualTagInput] = useState("");
  const [ossStatuses, setOssStatuses] = useState<Record<string, OssJobAssetStatus>>({});
  const [ossChecking, setOssChecking] = useState(false); const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>();
  const mergeOssStatuses = (values: OssJobAssetStatus[]) => setOssStatuses((current) => ({ ...current, ...Object.fromEntries(values.map((value) => [value.jobId, value])) }));
  const refreshFiles = async () => {
    if (!selected) return;
    const data = await api.files(selected.id); setFiles(data);
    const current = data.find((item) => item.absolutePath === file?.absolutePath) ?? data.find((item) => item.name === "meme-template.json") ?? data[0]; setFile(current);
    if (current && current.kind !== "image") setContent(await fetch(`/api/files?path=${encodeURIComponent(current.absolutePath)}`).then((response) => response.text()));
  };
  useEffect(() => { if (!selected) return; setSelectedId(selected.id); void api.files(selected.id).then((data) => { setFiles(data); const preferred = data.find((item) => item.name === "meme-template.json") ?? data[0]; setFile(preferred); }).catch(() => setFiles([])); }, [selected?.id]);
  useEffect(() => { if (!selected) return; void api.checkOssAssets([selected.id]).then(mergeOssStatuses).catch(() => undefined); }, [selected?.id]);
  useEffect(() => { if (!file || file.kind === "image") { setContent(""); return; } void fetch(`/api/files?path=${encodeURIComponent(file.absolutePath)}`).then((response) => response.text()).then(setContent); }, [file?.absolutePath]);
  useEffect(() => {
    if (file?.name !== "meme-template.json" || !content) return;
    try {
      const data = JSON.parse(content); const assignments = Array.isArray(data?.metadata?.tagAssignments) ? data.metadata.tagAssignments : [];
      setManualTagInput(assignments.filter((item: any) => item?.source === "operator" && item?.dimension === "manual" && item?.status === "accepted").map((item: any) => item.label).filter(Boolean).join(", "));
    } catch { setManualTagInput(""); }
  }, [file?.absolutePath, content]);
  const toggleChecked = (id: string) => setCheckedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const actionIds = () => checkedIds.size ? [...checkedIds] : selected ? [selected.id] : [];
  const checkOssAssets = async (onlyIds?: string[]) => {
    const ids = onlyIds ?? actionIds(); if (!ids.length) return; setOssChecking(true);
    try { const result = await perform(() => api.checkOssAssets(ids), `已检查 ${ids.length} 个结果的原图 OSS 状态`); if (result) mergeOssStatuses(result); }
    finally { setOssChecking(false); }
  };
  const retryOssAssets = async (onlyIds?: string[]) => {
    const ids = onlyIds ?? actionIds(); if (!ids.length || !confirm(`确认重新上传 ${ids.length} 个结果中的 source image，并在成功后更新 meme-template.json？`)) return;
    setUploadProgress({ current: 0, total: ids.length });
    await perform(async () => {
      const failures: string[] = [];
      for (let index = 0; index < ids.length; index += 1) {
        try { const result = await api.retryOssAssets([ids[index]]); mergeOssStatuses(result.map((item) => item.status)); }
        catch (reason) { failures.push(reason instanceof Error ? reason.message : String(reason)); }
        setUploadProgress({ current: index + 1, total: ids.length });
      }
      if (failures.length) throw new Error(`${failures.length} 个结果重传失败：${failures.join("；")}`);
      return true;
    }, `已完成 ${ids.length} 个结果的原图重传与 JSON 更新`);
    setUploadProgress(undefined); await refreshFiles();
    const checked = await api.checkOssAssets(ids).catch(() => []); if (checked.length) mergeOssStatuses(checked);
  };
  const applyTags = async () => {
    const tags = tagsFrom(tagInput); const result = await perform(() => api.addTemplateTags([...checkedIds], tags), `已为 ${checkedIds.size} 个处理结果添加标签`);
    if (!result) return;
    setTagInput(""); setCheckedIds(new Set());
    if (selected && checkedIds.has(selected.id)) await refreshFiles();
  };
  const saveManualTags = async () => {
    if (!selected) return; const tags = tagsFrom(manualTagInput);
    const result = await perform(() => api.setManualTemplateTags(selected.id, tags), "人工标签已更新"); if (result) await refreshFiles();
  };
  if (!selected) return <main className="empty-page"><h2>暂无可审核结果</h2><p>任务完成后，产物会集中显示在这里。</p></main>;
  const images = files.filter((item) => item.kind === "image"); const selectedOss = ossStatuses[selected.id];
  return <main className="results-layout"><aside className="result-jobs"><div className="section-title">最近结果</div><p className="result-select-help">勾选结果，可批量检查或辅助重传原图，并添加运营标签。</p>{candidates.map((job) => <div className={`result-job-row ${job.id === selected.id ? "active" : ""}`} key={job.id}><label title={job.status === "failed" ? "失败结果不能写入或上传" : "选择结果"}><input type="checkbox" checked={checkedIds.has(job.id)} disabled={job.status === "failed"} onChange={() => toggleChecked(job.id)} /><span className="sr-only">选择 {job.groupName}</span></label><button onClick={() => setSelectedId(job.id)}><strong>{job.groupName}</strong><small>{statusLabel[job.status]} · {ossStatuses[job.id] ? ossStateLabel[ossStatuses[job.id].state] : "OSS 未检查"}</small></button></div>)}{checkedIds.size > 0 && <div className="result-tag-editor"><strong>已选 {checkedIds.size} 个结果</strong><button className="full" disabled={ossChecking || Boolean(uploadProgress)} onClick={() => checkOssAssets()}>{ossChecking ? "正在检查…" : "检查原图 OSS"}</button><button className="primary full" disabled={Boolean(uploadProgress)} onClick={() => retryOssAssets()}>{uploadProgress ? `正在重传 ${uploadProgress.current}/${uploadProgress.total}` : "重新上传原图并更新 JSON"}</button><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && tagsFrom(tagInput).length) void applyTags(); }} placeholder="输入运营标签，逗号分隔" /><button className="full" disabled={!tagsFrom(tagInput).length || Boolean(uploadProgress)} onClick={applyTags}>添加并保存运营标签</button><button className="full" onClick={() => setCheckedIds(new Set())}>清空选择</button></div>}</aside><section className="result-main"><div className="page-heading compact-heading"><div><span className="eyebrow">RESULT REVIEW</span><h1>{selected.groupName}</h1><p>{selected.lastEvent}</p></div><button onClick={() => perform(() => api.openFolder(selected.resultDirectory), "已打开结果文件夹")}>打开结果文件夹</button></div>
    <div className="validation-strip">{selected.validatorResults.map((result, index) => <span className={result.passed ? "pass" : "fail"} key={`${result.file}-${index}`}>{result.validator}: {result.passed ? "PASS" : "FAIL"}</span>)}{!selected.validatorResults.length && <span>暂无 validator 结果</span>}</div>
    <section className={`oss-asset-panel ${selectedOss?.state ?? "unchecked"}`}><div className="oss-asset-heading"><div><span className="eyebrow">SOURCE IMAGE · OSS</span><h2>{selectedOss ? ossStateLabel[selectedOss.state] : "尚未检查原图"}</h2><p>{selectedOss?.message ?? (selectedOss ? `最后检查：${new Date(selectedOss.checkedAt).toLocaleString("zh-CN")}` : "检查 JSON 图片字段和 OSS 真实对象，不会执行写入。")}</p></div><div className="oss-asset-actions"><button disabled={ossChecking || Boolean(uploadProgress)} onClick={() => checkOssAssets([selected.id])}>{ossChecking ? "检查中…" : "二次检查"}</button><button className="primary" disabled={selected.status === "failed" || Boolean(uploadProgress)} onClick={() => retryOssAssets([selected.id])}>{uploadProgress ? `重传 ${uploadProgress.current}/${uploadProgress.total}` : "重新上传原图"}</button></div></div>{selectedOss?.templates.map((template) => <article className="oss-template-status" key={template.templateFile}><div><strong>{template.templateKey ?? "未知模板"}</strong><span className={template.state}>{ossStateLabel[template.state]}</span></div>{template.message && <p>{template.message}</p>}<ul>{template.fields.map((field) => <li key={field.field}><code>{field.field}</code><span>{field.state === "uploaded" ? "OSS 对象存在" : field.state === "not_uploaded" ? "仍为本地 source image" : field.message ?? field.state}</span></li>)}</ul></article>)}</section>
    <section className="manual-tag-panel"><div><span className="eyebrow">MANUAL TAGS</span><h2>结果二次标签</h2><p>只编辑人工补充的普通标签，AI 和外部来源标签保持不变。</p></div><div><input value={manualTagInput} disabled={selected.status === "failed" || Boolean(uploadProgress)} onChange={(event) => setManualTagInput(event.target.value)} placeholder="人工标签，逗号分隔；留空可清除" /><button disabled={selected.status === "failed" || Boolean(uploadProgress)} onClick={saveManualTags}>保存人工标签</button></div></section>
    {!!images.length && <div className="result-gallery">{images.map((image) => <button key={image.absolutePath} onClick={() => setFile(image)} className={file?.absolutePath === image.absolutePath ? "active" : ""}><img src={image.url} alt={image.name} /><small>{image.relativePath}</small></button>)}</div>}
    <div className="file-review"><div className="file-list">{files.filter((item) => item.kind !== "image").map((item) => <button key={item.absolutePath} className={file?.absolutePath === item.absolutePath ? "active" : ""} onClick={() => setFile(item)}><span>{item.kind === "json" ? "{}" : "MD"}</span><div><strong>{item.name}</strong><small>{item.relativePath}</small></div></button>)}</div><div className="file-preview">{file?.kind === "image" ? <img src={file.url} alt={file.name} /> : <pre>{content || "选择文件查看内容"}</pre>}</div></div>
  </section></main>;
}

export default App;
