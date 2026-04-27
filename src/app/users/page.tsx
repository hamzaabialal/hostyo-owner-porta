"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { primeEffectiveSessionCache, useEffectiveSession } from "@/lib/useEffectiveSession";
import AppShell from "@/components/AppShell";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  approved: boolean;
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
  const [createdUser, setCreatedUser] = useState<{ email: string; tempPassword: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [propertyOptions, setPropertyOptions] = useState<string[]>([]);

  const { isAdmin } = useEffectiveSession();
  void session;

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

  const filteredUsers = users.filter((u) => {
    if (filterRole === "admin" && !u.isAdmin) return false;
    if (filterRole === "owner" && u.isAdmin) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.properties.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const adminCount = users.filter((u) => u.isAdmin).length;
  const ownerCount = users.filter((u) => !u.isAdmin).length;
  const pendingCount = users.filter((u) => !u.isAdmin && !u.approved).length;

  return (
    <AppShell title="Users">
      <div className="text-[13px] text-[#888] mb-5 -mt-1">Manage property owners and admin users.</div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Total Users</div>
          <div className="text-[22px] font-bold text-[#111]">{users.length}</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Admins</div>
          <div className="text-[22px] font-bold text-[#111]">{adminCount}</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Owners</div>
          <div className="text-[22px] font-bold text-[#111]">{ownerCount}</div>
        </div>
        <div className="bg-white border border-[#eaeaea] rounded-xl p-4">
          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Pending</div>
          <div className="text-[22px] font-bold text-[#D4A843]">{pendingCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or property..."
            className="w-full h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white" />
        </div>
        <div className="flex items-center gap-1">
          {[{ label: "All", value: "" }, { label: "Admins", value: "admin" }, { label: "Owners", value: "owner" }].map((f) => (
            <button key={f.value} onClick={() => setFilterRole(f.value)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                filterRole === f.value ? "bg-[#80020E] text-white" : "bg-[#f5f5f5] text-[#555] hover:bg-[#eee]"
              }`}>{f.label}</button>
          ))}
        </div>
        <button onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 h-[38px] px-4 rounded-lg border border-[#80020E] text-[#80020E] text-[13px] font-medium hover:bg-[#80020E]/5 transition-colors ml-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invite User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#fafafa]">
              {["Name", "Email", "Role", "Status", "Properties", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#999] border-b border-[#eaeaea]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-[#999]">No users match your filters.</td></tr>
            ) : filteredUsers.map((u) => (
              <tr key={u.id} className="border-b border-[#f3f3f3] hover:bg-[#f9f9f9]">
                <td className="px-4 py-3">
                  <div className="font-medium text-[#111]">{u.name || "—"}</div>
                </td>
                <td className="px-4 py-3 text-[#666]">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`pill ${u.isAdmin ? "pill-live" : "pill-pending"}`}>{u.isAdmin ? "Admin" : "Owner"}</span>
                </td>
                <td className="px-4 py-3">
                  {u.isAdmin || u.approved ? (
                    <span className="pill pill-live">Approved</span>
                  ) : (
                    <button onClick={async () => {
                      await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved: true }) });
                      refreshUsers();
                    }} className="px-2.5 py-1 rounded-lg bg-[#80020E] text-white text-[11px] font-medium hover:bg-[#6b010c] transition-colors">
                      Approve
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-[#666] text-[12px] max-w-[200px] truncate">{u.properties || "All"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditUser(u)} className="text-[11px] font-medium text-[#888] hover:text-[#80020E] transition-colors">Edit</button>
                    {!u.isAdmin && (
                      <button
                        onClick={async () => {
                          if (!confirm(`View the app as ${u.name || u.email}? You'll stay signed in as admin; a banner will let you stop at any time.`)) return;
                          const res = await fetch("/api/impersonate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: u.email }),
                          });
                          const data = await res.json();
                          if (!res.ok || data.error) {
                            alert(data.error || `Failed (HTTP ${res.status})`);
                            return;
                          }
                          // Prime the cache with the impersonated scope so
                          // the post-redirect page renders the right UI on
                          // its first paint (no admin-nav flicker). The
                          // server enforces "impersonated user is never an
                          // admin" so isAdmin: false is always correct here.
                          const adminEmail = (session?.user?.email || "").toLowerCase() || null;
                          primeEffectiveSessionCache({
                            email: u.email.toLowerCase(),
                            isAdmin: false,
                            isImpersonating: true,
                            realEmail: adminEmail,
                          });
                          // Force a full reload so server-rendered data reflects the new scope
                          window.location.href = "/dashboard";
                        }}
                        className="text-[11px] font-medium text-[#3B5BA5] hover:text-[#2E4780] transition-colors"
                        title="View the app as this user"
                      >
                        Impersonate
                      </button>
                    )}
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
          onCreated={(email, tempPassword) => {
            refreshUsers();
            setInviteOpen(false);
            setCreatedUser({ email, tempPassword });
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

      {/* Created User Success Modal */}
      {createdUser && (
        <CreatedUserModal
          email={createdUser.email}
          tempPassword={createdUser.tempPassword}
          onClose={() => setCreatedUser(null)}
        />
      )}
    </AppShell>
  );
}

/* ── Invite Modal ── */
function InviteModal({ propertyOptions, onClose, onCreated }: { propertyOptions: string[]; onClose: () => void; onCreated: (email: string, tempPassword: string) => void }) {
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
      if (data.ok) onCreated(email, data.tempPassword);
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
  const [error, setError] = useState("");
  const [resetPasswordResult, setResetPasswordResult] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isAdmin, properties: selectedProps.join(", ") }),
      });
      const data = await res.json();
      if (data.ok) onSaved();
      else setError(data.error || "Failed to update user");
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResetPasswordResult(data.tempPassword);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch { setError("Network error"); }
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

            {/* Reset Password */}
            <div className="pt-3 border-t border-[#f0f0f0]">
              {resetPasswordResult ? (
                <ResetPasswordCard email={user.email} tempPassword={resetPasswordResult} />
              ) : (
                <button onClick={handleResetPassword} disabled={saving}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#888] hover:text-[#80020E] transition-colors disabled:opacity-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Reset Password
                </button>
              )}
            </div>

            {error && <p className="text-[12px] text-[#7A5252] font-medium mt-2">{error}</p>}
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

/* ── Created User Success Modal ── */
function CreatedUserModal({ email, tempPassword, onClose }: { email: string; tempPassword: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
  const shareText = `Welcome to Hostyo!\n\nYour account has been created.\n\nLogin: ${loginUrl}\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease change your password after logging in.`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-[440px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="pt-8 pb-2 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#EAF3EF] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div className="px-6 pb-2 text-center">
            <h2 className="text-[18px] font-bold text-[#111] mb-1">User Created Successfully</h2>
            <p className="text-[13px] text-[#888]">Share the login details below with the new user.</p>
          </div>
          <div className="px-6 py-4">
            <div className="bg-[#fafafa] border border-[#eaeaea] rounded-xl p-4 space-y-3">
              <div>
                <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Login URL</div>
                <div className="text-[13px] font-medium text-[#80020E] break-all">{loginUrl}</div>
              </div>
              <div className="border-t border-[#f0f0f0] pt-3">
                <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Email</div>
                <div className="text-[13px] font-medium text-[#111]">{email}</div>
              </div>
              <div className="border-t border-[#f0f0f0] pt-3">
                <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">Temporary Password</div>
                <div className="text-[16px] font-bold text-[#111] font-mono tracking-wider">{tempPassword}</div>
              </div>
            </div>
            <p className="text-[11px] text-[#999] mt-3 text-center">The user should change their password after first login.</p>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={handleCopy}
              className={`flex-1 h-[42px] rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors ${
                copied ? "bg-[#EAF3EF] text-[#2F6B57] border border-[#D6E7DE]" : "bg-[#111] text-white hover:bg-[#222]"
              }`}>
              {copied ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy Login Details</>
              )}
            </button>
            <button onClick={onClose}
              className="px-5 h-[42px] rounded-lg border border-[#e2e2e2] text-[13px] font-medium text-[#555] hover:bg-[#f5f5f5] transition-colors">
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Reset Password Card (inline in Edit Modal) ── */
function ResetPasswordCard({ email, tempPassword }: { email: string; tempPassword: string }) {
  const [copied, setCopied] = useState(false);
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
  const shareText = `Your Hostyo password has been reset.\n\nLogin: ${loginUrl}\nEmail: ${email}\nNew Password: ${tempPassword}\n\nPlease change your password after logging in.`;

  return (
    <div className="bg-[#EAF3EF] border border-[#D6E7DE] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F6B57" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span className="text-[13px] font-semibold text-[#2F6B57]">Password Reset</span>
      </div>
      <div className="bg-white rounded-lg p-3 mb-3">
        <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1">New Temporary Password</div>
        <div className="text-[16px] font-bold text-[#111] font-mono tracking-wider">{tempPassword}</div>
      </div>
      <button onClick={async () => { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className={`w-full h-[36px] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
          copied ? "bg-[#2F6B57] text-white" : "bg-white border border-[#D6E7DE] text-[#2F6B57] hover:bg-[#f0f8f4]"
        }`}>
        {copied ? (
          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
        ) : (
          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy Reset Details</>
        )}
      </button>
    </div>
  );
}
