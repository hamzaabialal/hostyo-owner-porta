"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  properties: string;
  createdAt: string;
}

export default function UsersPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = useSession() as any;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [propertyOptions, setPropertyOptions] = useState<string[]>([]);

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => {
      if (d.ok) setUsers(d.users);
    }).catch(() => {}).finally(() => setLoading(false));

    fetch("/api/properties").then((r) => r.json()).then((d) => {
      if (d.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPropertyOptions(d.data.map((p: any) => p.name).filter(Boolean).sort());
      }
    }).catch(() => {});
  }, []);

  const refreshUsers = () => {
    fetch("/api/users").then((r) => r.json()).then((d) => {
      if (d.ok) setUsers(d.users);
    }).catch(() => {});
  };

  if (!isAdmin) {
    return (
      <AppShell title="Users">
        <div className="flex items-center justify-center h-64 text-[#999] text-sm">You don&apos;t have permission to access this page.</div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Users">
        <div className="flex items-center justify-center h-64 text-[#999] text-sm">Loading users...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Users">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[13px] text-[#888] -mt-1">Manage property owners and admin users.</div>
        </div>
        <button onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 h-[38px] px-4 rounded-lg border border-[#80020E] text-[#80020E] text-[13px] font-medium hover:bg-[#80020E]/5 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invite User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#fafafa]">
              {["Name", "Email", "Role", "Properties", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-[#999]">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-[#f3f3f3] hover:bg-[#f9f9f9]">
                <td className="px-4 py-3">
                  <div className="font-medium text-[#111]">{u.name || "—"}</div>
                </td>
                <td className="px-4 py-3 text-[#666]">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`pill ${u.isAdmin ? "pill-live" : "pill-pending"}`}>{u.isAdmin ? "Admin" : "Owner"}</span>
                </td>
                <td className="px-4 py-3 text-[#666] text-[12px] max-w-[200px] truncate">{u.properties || "All"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditUser(u)} className="text-[11px] font-medium text-[#888] hover:text-[#80020E] transition-colors">Edit</button>
                    <button onClick={async () => {
                      if (!confirm(`Delete ${u.name || u.email}?`)) return;
                      await fetch(`/api/users/${u.id}`, { method: "DELETE" });
                      refreshUsers();
                    }} className="text-[11px] font-medium text-[#ccc] hover:text-[#7A5252] transition-colors">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <InviteModal
          propertyOptions={propertyOptions}
          onClose={() => setInviteOpen(false)}
          onCreated={(tempPassword) => {
            refreshUsers();
            setInviteOpen(false);
            alert(`User created! Temporary password: ${tempPassword}\n\nShare this with the user so they can log in and change their password.`);
          }}
        />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditModal
          user={editUser}
          propertyOptions={propertyOptions}
          onClose={() => setEditUser(null)}
          onSaved={() => { refreshUsers(); setEditUser(null); }}
        />
      )}
    </AppShell>
  );
}

/* ── Invite Modal ── */
function InviteModal({ propertyOptions, onClose, onCreated }: { propertyOptions: string[]; onClose: () => void; onCreated: (tempPassword: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("owner");
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!email.trim()) { setError("Email is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, properties: selectedProps.join(", ") }),
      });
      const data = await res.json();
      if (data.ok) onCreated(data.tempPassword);
      else setError(data.error || "Failed to create user");
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors placeholder:text-[#bbb]";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 pt-5 pb-0">
            <h2 className="text-[16px] font-bold text-[#111]">Invite User</h2>
            <button onClick={onClose} className="p-1 text-[#999] hover:text-[#555]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {role === "owner" && (
              <div>
                <label className="block text-[12px] font-medium text-[#888] mb-1.5">Assigned Properties</label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-2 border border-[#e2e2e2] rounded-lg">
                  {propertyOptions.map((p) => (
                    <button key={p} onClick={() => setSelectedProps((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        selectedProps.includes(p) ? "bg-[#80020E] text-white" : "bg-[#f5f5f5] text-[#555] hover:bg-[#eee]"
                      }`}>{p}</button>
                  ))}
                </div>
                {selectedProps.length > 0 && <p className="text-[10px] text-[#999] mt-1">{selectedProps.length} selected</p>}
              </div>
            )}
            {error && <p className="text-[12px] text-[#7A5252] font-medium">{error}</p>}
            <p className="text-[11px] text-[#999]">A temporary password will be generated. Share it with the user so they can log in.</p>
          </div>
          <div className="px-6 pb-5 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#e2e2e2] text-[13px] font-medium text-[#555] hover:bg-[#f5f5f5]">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#80020E] text-white text-[13px] font-medium hover:bg-[#6b010c] disabled:opacity-60">{saving ? "Creating..." : "Create & Get Password"}</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Edit Modal ── */
function EditModal({ user, propertyOptions, onClose, onSaved }: { user: User; propertyOptions: string[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [selectedProps, setSelectedProps] = useState<string[]>(user.properties ? user.properties.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isAdmin, properties: selectedProps.join(", ") }),
      });
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const inputCls = "w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 pt-5 pb-0">
            <h2 className="text-[16px] font-bold text-[#111]">Edit User</h2>
            <button onClick={onClose} className="p-1 text-[#999] hover:text-[#555]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Email</label>
              <input type="email" value={user.email} disabled className="w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#999] bg-[#f8f8f8] cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Role</label>
              <select value={isAdmin ? "admin" : "owner"} onChange={(e) => setIsAdmin(e.target.value === "admin")} className={inputCls}>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {!isAdmin && (
              <div>
                <label className="block text-[12px] font-medium text-[#888] mb-1.5">Assigned Properties</label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-2 border border-[#e2e2e2] rounded-lg">
                  {propertyOptions.map((p) => (
                    <button key={p} onClick={() => setSelectedProps((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        selectedProps.includes(p) ? "bg-[#80020E] text-white" : "bg-[#f5f5f5] text-[#555] hover:bg-[#eee]"
                      }`}>{p}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="px-6 pb-5 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#e2e2e2] text-[13px] font-medium text-[#555] hover:bg-[#f5f5f5]">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#80020E] text-white text-[13px] font-medium hover:bg-[#6b010c] disabled:opacity-60">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </div>
      </div>
    </>
  );
}
