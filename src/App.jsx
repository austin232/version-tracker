import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Utilities ---------- */
const LS_KEY = "devlog.version.bug.tracker.simple";
const uuid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
const nowISO = () => new Date().toISOString();

const seed = [
    {
        id: uuid(),
        label: "v0.1.0",
        date: nowISO(),
        summary: "Initial prototype with versions + bugs",
        notes: "Data is stored in localStorage. Use Export to save a JSON copy.",
        changes: [
            { id: uuid(), type: "add", text: "Version list with expandable details" },
            { id: uuid(), type: "add", text: "Bug tracker with severity & status" },
            { id: uuid(), type: "change", text: "Simplified UI (no external libs)" },
        ],
        bugs: [
            {
                id: uuid(),
                title: "Wheel collider slips at high speed",
                description: "Feels like 1970s cruiser on ice.",
                severity: "medium",
                status: "open",
                tags: ["physics", "handling"],
                createdAt: nowISO(),
                updatedAt: nowISO(),
            },
        ],
    },
];
// --- Semver helpers ---
function parseSemver(label) {
    const m = String(label || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return null;
    return { maj: +m[1], min: +m[2], pat: +m[3] };
}
function bumpSemver(label, kind = "patch") {
    const v = parseSemver(label) || { maj: 0, min: 0, pat: 0 };
    if (kind === "major") return `v${v.maj + 1}.0.0`;
    if (kind === "minor") return `v${v.maj}.${v.min + 1}.0`;
    return `v${v.maj}.${v.min}.${v.pat + 1}`;
}


/* ---------- LocalStorage Hook ---------- */
function usePersistentState(key, initial) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : initial;
        } catch {
            return initial;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch { }
    }, [key, value]);
    return [value, setValue];
}

/* ---------- Small UI Helpers ---------- */
const Box = ({ children }) => (
    <div className="card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        {children}
    </div>
);

const Btn = ({ children, onClick, variant = "default" }) => {
    const style = {
        default: { background: "#111827", color: "#fff" },
        secondary: { background: "#f3f4f6", color: "#111827" },
        danger: { background: "#dc2626", color: "#fff" },
    }[variant];
    return (
        <button onClick={onClick} style={{ ...style, border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
            {children}
        </button>
    );
};

const Input = (p) => <input {...p} style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 6, width: "100%" }} />;
const Textarea = (p) => <textarea {...p} style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 6, width: "100%" }} />;

/* ---------- Main App ---------- */
export default function App() {
    const [versions, setVersions] = usePersistentState(LS_KEY, seed);
    const [selectedId, setSelectedId] = useState(versions[0]?.id || null);
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState({});
    const [onlyOpenBugs, setOnlyOpenBugs] = useState(true);
    const fileRef = useRef(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return versions;
        return versions.filter((v) =>
            v.label.toLowerCase().includes(q) ||
            v.summary?.toLowerCase().includes(q) ||
            v.notes?.toLowerCase().includes(q) ||
            v.changes.some((c) => c.text.toLowerCase().includes(q)) ||
            v.bugs.some((b) => b.title.toLowerCase().includes(q) || b.tags.join(" ").toLowerCase().includes(q))
        );
    }, [versions, query]);
    // Right-sidebar filters
    const [globalBugQuery, setGlobalBugQuery] = useState("");
    const [globalSeverity, setGlobalSeverity] = useState("all"); // all | low | medium | high | critical
    const [globalOnlyOpen, setGlobalOnlyOpen] = useState(true);

    function bugColor(bug) {
        if (bug.status === "resolved") return "green";   // solved
        if (bug.status === "closed") return "gray";      // closed

        switch (bug.severity) {
            case "low": return "gold";                     // yellow
            case "medium": return "orange";                // yellow/orange
            case "high": return "darkorange";              // orange
            case "critical": return "red";                 // extreme
            default: return "gray";
        }
    }


    // All bugs across versions (with version metadata)
    const allBugs = useMemo(() => {
        return versions.flatMap(v =>
            (v.bugs || []).map(b => ({
                ...b,
                versionId: v.id,
                versionLabel: v.label,
            }))
        );
    }, [versions]);

    // Apply filters (text, severity, only-open), newest first
    const visibleGlobalBugs = useMemo(() => {
        const q = globalBugQuery.trim().toLowerCase();
        return allBugs
            .filter(b =>
                (globalOnlyOpen ? (b.status !== "resolved" && b.status !== "closed") : true) &&
                (globalSeverity === "all" || b.severity === globalSeverity) &&
                (
                    q === "" ||
                    b.title.toLowerCase().includes(q) ||
                    (b.tags || []).join(" ").toLowerCase().includes(q) ||
                    (b.description || "").toLowerCase().includes(q)
                )
            )
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }, [allBugs, globalBugQuery, globalSeverity, globalOnlyOpen]);


    const selected = versions.find((v) => v.id === selectedId) || null;

    /* ---- Version CRUD ---- */
    const addVersion = () => {
        // Use the most recent version’s label as the base (we prepend new versions)
        const latest = versions[0];
        const base = latest?.label || "v0.0.0";
        // Default bump is MINOR for a new release (change to "patch" if you prefer)
        const nextLabel = bumpSemver(base, "minor");

        const newV = {
            id: uuid(),
            label: nextLabel,
            date: nowISO(),
            summary: "",
            notes: "",
            changes: [],
            bugs: [],
        };
        setVersions([newV, ...versions]);
        setSelectedId(newV.id);
        setExpanded((e) => ({ ...e, [newV.id]: true }));
    };

    const updateVersion = (id, patch) => setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    const deleteVersion = (id) => { setVersions((prev) => prev.filter((v) => v.id !== id)); if (selectedId === id) setSelectedId(null); };
    const duplicateVersion = (id) => {
        const v = versions.find((x) => x.id === id); if (!v) return;
        const copy = { ...v, id: uuid(), label: v.label + "-copy", date: nowISO(), changes: v.changes.map((c) => ({ ...c, id: uuid() })), bugs: v.bugs.map((b) => ({ ...b, id: uuid(), status: "open", createdAt: nowISO(), updatedAt: nowISO() })) };
        setVersions([copy, ...versions]); setSelectedId(copy.id); setExpanded((e) => ({ ...e, [copy.id]: true }));
    };

    /* ---- Changes ---- */
    const addChange = (vid, type, text) => { const v = versions.find((x) => x.id === vid); if (!v) return; updateVersion(vid, { changes: [{ id: uuid(), type, text }, ...v.changes] }); };
    const removeChange = (vid, cid) => { const v = versions.find((x) => x.id === vid); if (!v) return; updateVersion(vid, { changes: v.changes.filter((c) => c.id !== cid) }); };

    /* ---- Bugs ---- */
    const addBug = (vid, partial) => {
        const v = versions.find((x) => x.id === vid); if (!v) return;
        const bug = { id: uuid(), title: partial.title || "Untitled bug", description: partial.description || "", severity: partial.severity || "low", status: partial.status || "open", tags: partial.tags || [], createdAt: nowISO(), updatedAt: nowISO() };
        updateVersion(vid, { bugs: [bug, ...v.bugs] });
    };
    const updateBug = (vid, bid, patch) => { const v = versions.find((x) => x.id === vid); if (!v) return; updateVersion(vid, { bugs: v.bugs.map((b) => (b.id === bid ? { ...b, ...patch, updatedAt: nowISO() } : b)) }); };
    const deleteBug = (vid, bid) => { const v = versions.find((x) => x.id === vid); if (!v) return; updateVersion(vid, { bugs: v.bugs.filter((b) => b.id !== bid) }); };

    /* ---- Import/Export ---- */
    const doExport = () => { const blob = new Blob([JSON.stringify(versions, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `devlog_${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`; a.click(); URL.revokeObjectURL(url); };
    const doImport = (file) => { const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (!Array.isArray(data)) throw new Error("bad"); setVersions(data); setSelectedId(data[0]?.id ?? null); } catch { alert("Import failed"); } }; reader.readAsText(file); };

    const openBugs = versions.reduce((a, v) => a + v.bugs.filter(b => b.status !== "resolved" && b.status !== "closed").length, 0);
    const visibleBugs = (selected?.bugs || []).filter(b => onlyOpenBugs ? (b.status !== "resolved" && b.status !== "closed") : true);

    return (
        <div
            className="app"
            style={{
                display: "grid",
                gridTemplateColumns: "320px 1fr 320px", // <-- was "320px 1fr"
                gap: 16,
                padding: 16,
                background: "#f4f6f8",
                minHeight: "100vh",
            }}
        >
            {/* Sidebar */}
            <aside className="panel" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <h1 style={{ fontSize: 18, fontWeight: 800 }}>Changelog</h1>
                    <Btn onClick={addVersion}>+ New</Btn>
                </div>
                <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />

                <Box>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Versions</p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {filtered.map((v) => {
                            const isExpanded = expanded[v.id];
                            const openCount = v.bugs.filter(b => b.status !== "resolved" && b.status !== "closed").length;
                            return (
                                <li key={v.id} style={{ borderTop: "1px solid #eee" }}>
                                    <div style={{ padding: "8px", cursor: "pointer", background: selectedId === v.id ? "#f9fafb" : "" }} onClick={() => setSelectedId(v.id)}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{v.label} — {v.summary || "(no summary)"}</div>
                                        <div style={{ fontSize: 11, color: "#6b7280" }}>{new Date(v.date).toLocaleDateString()} | bugs {openCount}/{v.bugs.length}</div>
                                    </div>
                                    <button onClick={() => setExpanded(e => ({ ...e, [v.id]: !e[v.id] }))}>{isExpanded ? "▾" : "▸"}</button>
                                    {isExpanded && (
                                        <div style={{ padding: "6px 12px" }}>
                                            <Box>
                                                <div className="section-title">Patch Notes</div>
                                                {v.changes.length ? <ul>{v.changes.map(c => <li key={c.id}><b>{c.type}</b> {c.text}</li>)}</ul> : <div>No notes</div>}
                                            </Box>
                                            <Box>
                                                <div className="section-title">Bug History</div>
                                                {v.bugs.length ? <ul>{v.bugs.map(b => <li key={b.id}>{b.title} — {b.status}</li>)}</ul> : <div>No bugs</div>}
                                            </Box>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </Box>

                <Box>
                    <Btn variant="secondary" onClick={doExport}>Export</Btn>
                    <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} />
                    <Btn variant="secondary" onClick={() => fileRef.current.click()}>Import</Btn>
                </Box>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <Btn variant="secondary" onClick={() => duplicateVersion(selected.id)}>Duplicate</Btn>
                    <Btn variant="danger" onClick={() => deleteVersion(selected.id)}>Delete</Btn>
                </div>


                <Box><div>Open bugs: {openBugs}</div></Box>
            </aside>

            {/* Main */}
            <main className="panel" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
                {!selected ? <div>Select a version</div> : (
                    <>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                            {/* Editable version label */}
                            <Input
                                style={{ maxWidth: 180 }}
                                value={selected.label}
                                onChange={(e) => updateVersion(selected.id, { label: e.target.value })}
                                placeholder="v1.2.3"
                            />
                            {/* Quick bump buttons */}
                            <Btn variant="secondary" onClick={() => updateVersion(selected.id, { label: bumpSemver(selected.label, "major") })}>
                                +Major
                            </Btn>
                            <Btn variant="secondary" onClick={() => updateVersion(selected.id, { label: bumpSemver(selected.label, "minor") })}>
                                +Minor
                            </Btn>
                            <Btn variant="secondary" onClick={() => updateVersion(selected.id, { label: bumpSemver(selected.label, "patch") })}>
                                +Patch
                            </Btn>
                        </div>

                        {/* Summary stays the same below */}
                        <Input
                            value={selected.summary}
                            onChange={(e) => updateVersion(selected.id, { summary: e.target.value })}
                            placeholder="Summary"
                        />

                        {/* Patch notes */}
                        <Box>
                            <div className="h2">Add Change</div>
                            <ChangeComposer onAdd={(t, txt) => addChange(selected.id, t, txt)} />
                        </Box>
                        <Box>
                            <div className="h2">Patch Notes</div>
                            {selected.changes.length ? <ul>{selected.changes.map(c => <li key={c.id}><b>{c.type}</b> {c.text} <Btn variant="secondary" onClick={() => removeChange(selected.id, c.id)}>x</Btn></li>)}</ul> : <div>No changes yet</div>}
                        </Box>

                        {/* Bugs */}
                        <Box>
                            <div className="h2">New Bug</div>
                            <BugComposer onAdd={(b) => addBug(selected.id, b)} />
                        </Box>
                        <Box>
                            <div className="h2" style={{ display: "flex", justifyContent: "space-between" }}>
                                Bugs
                                <Btn variant="secondary" onClick={() => setOnlyOpenBugs(!onlyOpenBugs)}>{onlyOpenBugs ? "Show: All" : "Show: Only Open"}</Btn>
                            </div>
                            {visibleBugs.length ? <ul>{visibleBugs.map(b => (
                                <li key={b.id} style={{ marginBottom: 6, border: "1px solid #eee", borderRadius: 6, padding: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: "50%",
                                                background: bugColor(b),
                                                display: "inline-block",
                                            }}
                                        />
                                        <b>{b.title}</b> ({b.severity}) — {b.status}
                                    </div>

                                    <div>{b.description}</div>
                                    <Btn variant="secondary" onClick={() => updateBug(selected.id, b.id, { status: "resolved" })}>Resolve</Btn>
                                    <Btn variant="danger" onClick={() => deleteBug(selected.id, b.id)}>Delete</Btn>
                                </li>
                            ))}</ul> : <div>No bugs</div>}
                        </Box>

                        {/* Notes */}
                        <Box>
                            <div className="h2">Notes</div>
                            <Textarea rows={6} value={selected.notes} onChange={(e) => updateVersion(selected.id, { notes: e.target.value })} />
                        </Box>
                    </>
                )}
            </main>
            {/* Right Sidebar: Global Bug List */}
            <aside className="panel" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800 }}>Open Bugs (All Versions)</h2>
                    <button
                        className="btn secondary"
                        style={{ border: "1px solid #d1d5db", background: "#f3f4f6", color: "#111827", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
                        onClick={() => setGlobalOnlyOpen(!globalOnlyOpen)}
                    >
                        {globalOnlyOpen ? "Show: All" : "Show: Only Open"}
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                    <input
                        placeholder="Search bugs (title, tags, desc)…"
                        value={globalBugQuery}
                        onChange={(e) => setGlobalBugQuery(e.target.value)}
                        style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 6, width: "100%" }}
                    />
                    <select
                        value={globalSeverity}
                        onChange={(e) => setGlobalSeverity(e.target.value)}
                        style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 6, width: "100%" }}
                    >
                        {["all", "low", "medium", "high", "critical"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* List */}
                <div className="card" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, maxHeight: "calc(100vh - 220px)", overflow: "auto" }}>
                    {visibleGlobalBugs.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 13 }}>No bugs match the filters.</div>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {visibleGlobalBugs.map((b) => {
                                const closed = (b.status === "resolved" || b.status === "closed");
                                return (
                                    <li key={b.id} style={{ borderTop: "1px solid #eef0f3", padding: "8px 6px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                            <div style={{ minWidth: 0, cursor: "pointer" }} onClick={() => setSelectedId(b.versionId)}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    <span
                                                        style={{
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: "50%",
                                                            background: bugColor(b),
                                                            display: "inline-block",
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    {b.title}
                                                </div>

                                                </div>
                                                <div style={{ fontSize: 11, color: "#6b7280" }}>
                                                    {b.severity} • {b.status.replace("_", " ")} • {new Date(b.updatedAt).toLocaleDateString()}
                                                </div>
                                                <div style={{ fontSize: 11, color: "#6b7280" }}>
                                                    in <span style={{ fontWeight: 600 }}>{b.versionLabel}</span>
                                                </div>
                                                {b.tags?.length ? (
                                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                                                        {b.tags.map(t => (
                                                            <span key={t} style={{ fontSize: 11, background: "#f3f4f6", borderRadius: 999, padding: "2px 8px" }}>#{t}</span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                {!closed && (
                                                    <Btn variant="secondary" onClick={() => {
                                                        // jump to version & show only open in main list
                                                        setSelectedId(b.versionId);
                                                        // you already have updateBug in scope via closure on main
                                                        // but we need the versionId; we'll call updateBug using that:
                                                        const vid = b.versionId; const bid = b.id;
                                                        // mark resolved
                                                        const patch = { status: "resolved" };
                                                        // Quick inline call (reusing updateBug from App scope)
                                                        // eslint-disable-next-line no-undef
                                                        updateBug(vid, bid, patch);
                                                    }}>Resolve</Btn>
                                                )}
                                                <Btn variant="danger" onClick={() => {
                                                    setSelectedId(b.versionId);
                                                    // eslint-disable-next-line no-undef
                                                    deleteBug(b.versionId, b.id);
                                                }}>Delete</Btn>
                                        </div>
                                            
                                    </li>
                                        
                                    
                                );
                            })}
                        </ul>
                    )}
                </div>
            </aside>

        </div>
    );
}

/* ---------- Composers ---------- */
function ChangeComposer({ onAdd }) {
    const [type, setType] = useState("add");
    const [text, setText] = useState("");
    return (
        <div style={{ display: "flex", gap: 6 }}>
            <select value={type} onChange={(e) => setType(e.target.value)}>
                {["add", "fix", "change", "remove"].map(t => <option key={t}>{t}</option>)}
            </select>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Change text" />
            <Btn onClick={() => { if (text.trim()) { onAdd(type, text.trim()); setText(""); } }}>Add</Btn>
        </div>
    );
}
function BugComposer({ onAdd }) {
    const [title, setTitle] = useState(""), [desc, setDesc] = useState(""), [sev, setSev] = useState("low"), [tags, setTags] = useState("");
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Input placeholder="Bug title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea rows={3} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div style={{ display: "flex", gap: 6 }}>
                <select value={sev} onChange={(e) => setSev(e.target.value)}>{["low", "medium", "high", "critical"].map(s => <option key={s}>{s}</option>)}</select>
                <Input placeholder="Tags (comma)" value={tags} onChange={(e) => setTags(e.target.value)} />
                <Btn onClick={() => { if (title.trim()) { onAdd({ title, description: desc, severity: sev, tags: tags.split(",").map(s => s.trim()).filter(Boolean) }); setTitle(""); setDesc(""); setSev("low"); setTags(""); } }}>Add Bug</Btn>
            </div>
        </div>
    );
}
