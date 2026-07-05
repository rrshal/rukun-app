import { useEffect, useState } from "react";
import { db as firestoreDb, collection, getDocs, setDoc, deleteDoc, doc } from "./firebase";

const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();
const fmtTime = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const seed = {
  users: [
    { id: "u_org", role: "Organizer", fullName: "Hajj 2026 Organizer", phone: "0500000000", password: "1234", nationalId: "ORG001", campaignId: "c1", pilgrimQr: null },
    { id: "u_p1", role: "Pilgrim", fullName: "Manal Omar", phone: "0511111111", password: "1234", nationalId: "P001", campaignId: "c1", pilgrimQr: "PILGRIM-1001" },
    { id: "u_p2", role: "Pilgrim", fullName: "Ahmed Omar", phone: "0522222222", password: "1234", nationalId: "P002", campaignId: "c1", pilgrimQr: "PILGRIM-1076" },
    { id: "u_p3", role: "Pilgrim", fullName: "Raneem Ali", phone: "0533333333", password: "1234", nationalId: "P003", campaignId: "c1", pilgrimQr: "PILGRIM-2836" },
  ],
  campaigns: [
    { id: "c1", name: "Hajj 2026", joinCode: "RUKUN26", qr: "CAMPAIGN-RUKUN26", emergencyPhone: "0555555555", active: true, organizerId: "u_org" },
  ],
  scheduleItems: [
    { id: "s1", campaignId: "c1", activityName: "Arrive at Mina", time: "2026-05-26T06:00" },
    { id: "s2", campaignId: "c1", activityName: "Dhuhr Prayer", time: "2026-05-26T12:10" },
    { id: "s3", campaignId: "c1", activityName: "Group Movement Briefing", time: "2026-05-26T16:30" },
  ],
  announcements: [
    { id: "a1", campaignId: "c1", content: "Please keep your bracelet visible during all bus trips.", timestamp: nowIso() },
  ],
  trips: [
    { id: "t1", campaignId: "c1", name: "Gate to Mina", dateTime: "2026-05-26T05:30", checkedInUserIds: ["u_p1"] },
  ],
  notifications: [],
};

const collectionNames = ["users", "campaigns", "scheduleItems", "announcements", "trips", "notifications"];

const emptyDb = {
  users: [],
  campaigns: [],
  scheduleItems: [],
  announcements: [],
  trips: [],
  notifications: [],
};

function cleanForFirestore(obj) {
  // Convert object to string and back to clean up undefined fields
  const jsonString = JSON.stringify(obj);
  const cleanObj = JSON.parse(jsonString);
  return cleanObj;
}

function fixMissingData(data) {
  if (!data) {
    return {
      users: [],
      campaigns: [],
      scheduleItems: [],
      announcements: [],
      trips: [],
      notifications: [],
    };
  }
  return {
    users: data.users ? data.users : [],
    campaigns: data.campaigns ? data.campaigns : [],
    scheduleItems: data.scheduleItems ? data.scheduleItems : [],
    announcements: data.announcements ? data.announcements : [],
    trips: data.trips ? data.trips : [],
    notifications: data.notifications ? data.notifications : [],
  };
}

function useRukunStore() {
  const [db, setDb] = useState(emptyDb);
  const [loading, setLoading] = useState(true);

  async function loadCollection(name) {
    const snapshot = await getDocs(collection(firestoreDb, name));

    let list = [];
    for (let i = 0; i < snapshot.docs.length; i++) {
      let snap = snapshot.docs[i];
      let data = snap.data();
      data.id = snap.id; //set document ID directly on object
      list.push(data);
    }
    return list;
  }

  async function loadData() {
    setLoading(true);
    try {
      const loaded = {};
      for (let name of collectionNames) {
        loaded[name] = await loadCollection(name);
      }
      const checkedDb = fixMissingData(loaded);
      const hasData = collectionNames.some((name) => checkedDb[name].length > 0);

      if (!hasData) {
        await syncDbToFirestore(seed);
        setDb(seed);
      } else {
        setDb(checkedDb);
      }
    } catch (error) {
      console.error("Firebase load error:", error);
      setDb(seed);
    } finally {
      setLoading(false);
    }
  }

  async function syncDbToFirestore(nextDb) {
    const shaped = fixMissingData(nextDb);

    for (let name of collectionNames) {
      const items = shaped[name] || [];

      // Save each item
      for (let item of items) {
        await setDoc(doc(firestoreDb, name, item.id), cleanForFirestore(item));
      }

      // Check for deleted items to remove from Firestore
      const snapshot = await getDocs(collection(firestoreDb, name));
      for (let docSnap of snapshot.docs) {
        const stillExists = items.some((item) => item.id === docSnap.id);
        if (!stillExists) {
          await deleteDoc(doc(firestoreDb, name, docSnap.id));
        }
      }
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function save(updateFunction) {
    const nextDb = updateFunction(db);
    const cleanedDb = fixMissingData(nextDb);
    setDb(cleanedDb);

    try {
      await syncDbToFirestore(cleanedDb);
    } catch (error) {
      console.error("Firebase save error:", error);
    }
  }

  async function reset() {
    setDb(seed);
    try {
      await syncDbToFirestore(seed);
    } catch (error) {
      console.error("Firebase reset error:", error);
    }
  }

  return { db, save, reset, loading };
}

function Card({ children, className = "" }) {
  return <div className={`rounded-[1.75rem] bg-white/92 shadow-lg ring-1 ring-stone-200/80 backdrop-blur ${className}`}>{children}</div>;
}
function Button({ children, className = "", variant = "primary", ...props }) {
  const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
  const styles = variant === "danger" ? "bg-red-600 text-white hover:bg-red-700" : variant === "soft" ? "bg-stone-100 text-stone-800 hover:bg-stone-200" : variant === "dark" ? "bg-stone-900 text-white hover:bg-black" : "bg-[#967a4a] text-white hover:bg-[#7b643d]";
  return <button className={`${base} ${styles} ${className}`} {...props}>{children}</button>;
}
function Input({ label, ...props }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-600">{label}</span><input className="w-full rounded-2xl border border-stone-300 bg-white/90 px-4 py-3 text-base outline-none focus:border-[#967a4a]" {...props} /></label>;
}
function Textarea({ label, ...props }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-600">{label}</span><textarea className="min-h-32 w-full rounded-2xl border border-stone-300 bg-white/90 px-4 py-3 text-base outline-none focus:border-[#967a4a]" {...props} /></label>;
}
function Badge({ children }) { return <span className="max-w-full truncate rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700">{children}</span>; }
function FakeQR({ value, small = false }) {
  const bits = Array.from({ length: small ? 49 : 81 }, (_, i) => (value.charCodeAt(i % value.length) + i * 7) % 3 !== 0);
  return <div className={`grid ${small ? "grid-cols-7" : "grid-cols-9"} gap-0.5 rounded-xl bg-white p-2 shadow-inner`} aria-label={`QR ${value}`}>{bits.map((b, i) => <span key={i} className={`${small ? "h-2 w-2" : "h-3 w-3"} ${b ? "bg-stone-900" : "bg-stone-100"}`} />)}</div>;
}

export default function RukunApp() {
  const { db, save, reset, loading } = useRukunStore();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [screen, setScreen] = useState("welcome");
  const [message, setMessage] = useState("");
  const currentUser = db.users.find((u) => u.id === currentUserId) || null;
  const campaign = currentUser?.campaignId ? db.campaigns.find((c) => c.id === currentUser.campaignId && c.active) : null;
  const pilgrims = campaign ? db.users.filter((u) => u.campaignId === campaign.id && u.role === "Pilgrim") : [];
  const notify = (txt) => { setMessage(txt); setTimeout(() => setMessage(""), 3000); };

  if (loading) {
    return <div className="min-h-screen bg-stone-300 p-3 text-stone-900">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[430px] place-items-center rounded-[2.25rem] bg-[radial-gradient(circle_at_top,#f7efe2,#d8d1c4_45%,#b9aa92)] shadow-2xl ring-4 ring-stone-900/80">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#967a4a] text-2xl font-black text-white">ركن</div>
          <h1 className="text-2xl font-black">Loading Rukun data...</h1>
          <p className="mt-2 text-sm text-stone-600">Connecting to Firebase Firestore.</p>
        </Card>
      </div>
    </div>;
  }

  const login = (phone, password) => {
    const user = db.users.find((u) => u.phone === phone && u.password === password);
    if (!user) return notify("Invalid phone number or password.");
    setCurrentUserId(user.id); setScreen(user.role === "Organizer" ? "orgHome" : "pilgrimHome"); notify(`Welcome, ${user.fullName}`);
  };

  const register = (form) => {
    if (!form.phone || !form.password || !form.fullName || !form.nationalId || !form.role) return notify("Please complete all registration fields.");
    if (db.users.some((u) => u.phone === form.phone)) return notify("This phone number is already registered.");
    const userId = uid("u");
    const qrId = `PILGRIM-${Math.floor(1000 + Math.random() * 9000)}`;

    const user = {
      id: userId,
      ...form,
      campaignId: null,
      pilgrimQr: form.role === "Pilgrim" ? qrId : null,
    };
    save((d) => ({ ...d, users: [...d.users, user] }));
    setCurrentUserId(user.id); setScreen(form.role === "Organizer" ? "orgJoinCreate" : "joinCampaign"); notify("Account created successfully.");
  };

  const logout = () => { setCurrentUserId(null); setScreen("welcome"); notify("Logged out."); };

  const joinCampaign = (code) => {
    const camp = db.campaigns.find((c) => c.active && (c.joinCode.toLowerCase() === code.toLowerCase() || c.qr.toLowerCase() === code.toLowerCase()));
    if (!camp) return notify("Campaign code not found.");
    save((d) => ({ ...d, users: d.users.map((u) => u.id === currentUser.id ? { ...u, campaignId: camp.id, pilgrimQr: u.pilgrimQr } : u) }));
    setScreen(currentUser.role === "Organizer" ? "orgHome" : "pilgrimHome"); notify("Joined campaign successfully.");
  };

  const createCampaign = ({ name, emergencyPhone }) => {
    if (!name || !emergencyPhone) return notify("Enter campaign name and emergency phone.");
    const joinCode = `RK${Math.floor(1000 + Math.random() * 9000)}`;
    const camp = { id: uid("c"), name, emergencyPhone, joinCode, qr: `CAMPAIGN-${joinCode}`, active: true, organizerId: currentUser.id };
    save((d) => ({ ...d, campaigns: [...d.campaigns, camp], users: d.users.map((u) => u.id === currentUser.id ? { ...u, campaignId: camp.id } : u) }));
    setScreen("orgHome"); notify("Campaign created with unique join code.");
  };

  const endCampaign = () => {
    if (!campaign) return;
    save((d) => ({ ...d, campaigns: d.campaigns.map((c) => c.id === campaign.id ? { ...c, active: false } : c), users: d.users.map((u) => u.campaignId === campaign.id ? { ...u, campaignId: null } : u) }));
    setScreen("orgJoinCreate"); notify("Campaign ended and all users were unlinked.");
  };

  const addSchedule = (activityName, time) => {
    if (!activityName || !time) return notify("Enter activity name and time.");
    save((d) => ({ ...d, scheduleItems: [...d.scheduleItems, { id: uid("s"), campaignId: campaign.id, activityName, time }] })); notify("Schedule item added.");
  };

  const updateSchedule = (id, patch) => save((d) => ({ ...d, scheduleItems: d.scheduleItems.map((s) => s.id === id ? { ...s, ...patch } : s) }));
  const deleteSchedule = (id) => { save((d) => ({ ...d, scheduleItems: d.scheduleItems.filter((s) => s.id !== id) })); notify("Schedule item deleted."); };
  const postAnnouncement = (content) => {
    if (!content.trim()) return notify("Announcement cannot be empty.");
    const ann = { id: uid("a"), campaignId: campaign.id, content, timestamp: nowIso() };
    const notifications = pilgrims.map((p) => ({
      id: uid("n"),
      userId: p.id,
      campaignId: campaign.id,
      title: "New announcement",
      content,
      timestamp: nowIso(),
      delivered: true,
    }));
    save((d) => ({ ...d, announcements: [ann, ...d.announcements], notifications: [...notifications, ...d.notifications] }));
    notify(`Announcement posted. Push notification sent to ${notifications.length} pilgrims.`);
  };

  const createTrip = (name, dateTime) => {
    if (!name || !dateTime) return notify("Enter trip name and date/time.");
    save((d) => ({ ...d, trips: [...d.trips, { id: uid("t"), campaignId: campaign.id, name, dateTime, checkedInUserIds: [] }] })); notify("Trip created.");
  };

  const scanPilgrim = (tripId, qrOrId) => {
    const scannedValue = qrOrId.trim();
    const pilgrim = pilgrims.find((p) => p.pilgrimQr === scannedValue);
    if (!pilgrim) return notify("QR code not found in this campaign. Please scan the pilgrim QR code.");
    const trip = db.trips.find((t) => t.id === tripId);
    if (trip.checkedInUserIds.includes(pilgrim.id)) return notify("This pilgrim is already checked in for this trip.");
    save((d) => ({ ...d, trips: d.trips.map((t) => t.id === tripId ? { ...t, checkedInUserIds: [...t.checkedInUserIds, pilgrim.id] } : t) })); notify(`${pilgrim.fullName} checked in.`);
  };

  const editCampaign = ({ name, emergencyPhone }) => {
    save((d) => ({ ...d, campaigns: d.campaigns.map((c) => c.id === campaign.id ? { ...c, name: name || c.name, emergencyPhone: emergencyPhone || c.emergencyPhone } : c) })); notify("Campaign information updated.");
  };

  const clearNewNotifications = () => {
    if (!currentUser) return;
    save((d) => ({
      ...d,
      notifications: d.notifications.filter((n) => n.userId !== currentUser.id),
    }));
  };

  const callEmergency = () => {
    if (!campaign?.emergencyPhone) return notify("Emergency phone number is missing.");
    window.location.href = `tel:${campaign.emergencyPhone}`;
    notify(`Opening dialer for ${campaign.emergencyPhone}`);
  };

  const printBracelet = (pilgrim) => {
    if (!pilgrim.pilgrimQr) return notify("QR code missing. Printing blocked.");
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Rukun Bracelet</title><style>body{font-family:Arial;padding:24px}.band{border:2px solid #333;border-radius:20px;padding:18px;width:620px}.qr{font-size:24px;letter-spacing:2px;border:1px dashed #333;padding:16px;margin:12px 0}</style></head><body><div class='band'><h2>Rukun Pilgrim Bracelet</h2><p><b>Name:</b> ${pilgrim.fullName}</p><p><b>Campaign:</b> ${campaign.name}</p><div class='qr'>QR: ${pilgrim.pilgrimQr}</div><p><b>Emergency:</b> ${campaign.emergencyPhone}</p></div><script>window.print()</script></body></html>`);
    notify("Printable bracelet generated.");
  };

  const content = () => {
    if (screen === "welcome") return <Welcome onLogin={() => setScreen("login")} onRegister={() => setScreen("register")} />;
    if (screen === "login") return <Login onLogin={login} goBack={() => setScreen("welcome")} />;
    if (screen === "register") return <Register onRegister={register} goBack={() => setScreen("welcome")} />;
    if (!currentUser) return <Welcome onLogin={() => setScreen("login")} onRegister={() => setScreen("register")} />;
    if (!campaign && currentUser.role === "Organizer" && screen !== "orgJoinCreate") return <OrganizerJoinCreate onCreate={createCampaign} onJoin={joinCampaign} />;
    if (!campaign && currentUser.role === "Pilgrim" && screen !== "joinCampaign") return <JoinCampaign onJoin={joinCampaign} user={currentUser} />;
    if (screen === "orgJoinCreate") return <OrganizerJoinCreate onCreate={createCampaign} onJoin={joinCampaign} />;
    if (screen === "joinCampaign") return <JoinCampaign onJoin={joinCampaign} user={currentUser} />;
    if (currentUser.role === "Organizer") return <OrganizerDashboard {...{ db, currentUser, campaign, pilgrims, screen, setScreen, addSchedule, updateSchedule, deleteSchedule, postAnnouncement, createTrip, scanPilgrim, editCampaign, endCampaign, printBracelet }} />;
    return <PilgrimDashboard {...{ db, currentUser, campaign, screen, setScreen, callEmergency, clearNewNotifications }} />;
  };

  return <div className="min-h-screen bg-stone-300 p-3 text-stone-900 sm:p-6">
    <div className="relative mx-auto flex h-[calc(100svh-1.5rem)] min-h-[620px] w-full max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] bg-[radial-gradient(circle_at_top,#f8efe1,#ded4c4_45%,#b9aa92)] shadow-2xl ring-4 ring-stone-900/80 sm:h-[860px]">
      <header className="sticky top-0 z-30 shrink-0 rounded-b-[2rem] bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#967a4a] text-xl font-black text-white">ركن</div><div className="min-w-0"><h1 className="truncate text-xl font-black">Rukun</h1><p className="truncate text-xs text-stone-600">Hajj campaign coordination</p></div></div>
          {currentUser && <Button className="min-h-10 shrink-0 px-3 py-2 text-xs" variant="dark" onClick={logout}>Logout</Button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">{currentUser && <Badge>{currentUser.role}: {currentUser.fullName}</Badge>}{campaign && <Badge>{campaign.joinCode}</Badge>}<Button className="min-h-9 px-3 py-2 text-xs" variant="soft" onClick={reset}>Reset</Button></div>
      </header>
      {message && <div className="mx-4 mt-3 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">{message}</div>}
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-56">{content()}</main>
    </div>
  </div>;
}

function Welcome({ onLogin, onRegister }) {
  return <Card className="overflow-hidden">
    <div className="relative min-h-[620px]">
      <div
        className="absolute inset-x-0 top-0 h-56 bg-[url('https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=1400&auto=format&fit=crop')] bg-cover bg-center"
        aria-label="Hajj background image"
      />
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/15 via-transparent to-white" />
      <div className="relative flex min-h-[620px] flex-col justify-end p-6">
        <p className="mb-3 text-lg font-black text-[#967a4a]">السلام عليكم، أهلاً بكم</p>
        <h2 className="text-4xl font-black leading-tight tracking-tight">
          Rukun: app for Hajj campaigns.
        </h2>
        <p className="mt-4 text-sm leading-6 text-stone-600">Manage schedules, announcements, QR attendance, bracelets, emergency contacts, and Hajj guidance in one place.</p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <Button className="w-full" onClick={onRegister}>Register</Button>
          <Button className="w-full" variant="soft" onClick={onLogin}>Login</Button>
        </div>

        <p className="mt-6 rounded-2xl bg-stone-50/90 p-3 text-xs leading-5 text-stone-500">
          Demo accounts: organizer 0500000000 / 1234, pilgrim 0511111111 / 1234
        </p>
      </div>
    </div>
  </Card>;
}
function Login({ onLogin, goBack }) { const [phone, setPhone] = useState(""); const [password, setPassword] = useState(""); return <Card className="mx-auto max-w-full p-6"><h2 className="mb-5 text-2xl font-black">Login</h2><div className="grid gap-4"><Input label="Phone number" value={phone} onChange={e => setPhone(e.target.value)} /><Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} /><Button onClick={() => onLogin(phone, password)}>Login</Button><Button variant="soft" onClick={goBack}>Back</Button></div></Card>; }
function Register({ onRegister, goBack }) { const [form, setForm] = useState({ role: "Pilgrim", fullName: "", phone: "", password: "", nationalId: "" }); return <Card className="mx-auto max-w-full p-6"><h2 className="mb-5 text-2xl font-black">Register</h2><div className="grid gap-4"><label className="block"><span className="mb-1 block text-xs font-semibold text-stone-600">Role</span><select className="w-full rounded-xl border border-stone-300 bg-white/90 px-3 py-2 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option>Pilgrim</option><option>Organizer</option></select></label><Input label="Full name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /><Input label="Phone number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><Input label="National ID / Passport" value={form.nationalId} onChange={e => setForm({ ...form, nationalId: e.target.value })} /><Input label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><Button onClick={() => onRegister(form)}>Create account</Button><Button variant="soft" onClick={goBack}>Back</Button></div></Card>; }
function OrganizerJoinCreate({ onCreate, onJoin }) { const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [code, setCode] = useState(""); return <div className="grid gap-4"><Card className="p-6"><h2 className="mb-4 text-2xl font-black">Create campaign</h2><div className="grid gap-4"><Input label="Campaign name" value={name} onChange={e => setName(e.target.value)} /><Input label="Emergency phone" value={phone} onChange={e => setPhone(e.target.value)} /><Button onClick={() => onCreate({ name, emergencyPhone: phone })}>Create</Button></div></Card><Card className="p-6"><h2 className="mb-4 text-2xl font-black">Join campaign</h2><div className="grid gap-4"><Input label="Join code or campaign QR value" value={code} onChange={e => setCode(e.target.value)} placeholder="Example: RUKUN26" /><Button onClick={() => onJoin(code)}>Join</Button></div></Card></div>; }
function JoinCampaign({ onJoin, user }) { const [code, setCode] = useState(""); return <Card className="mx-auto max-w-full p-6"><h2 className="text-2xl font-black">Hi {user.fullName}</h2><p className="mb-4 text-stone-600">Enter or scan your campaign code.</p><div className="grid gap-4"><Input label="Code" value={code} onChange={e => setCode(e.target.value)} placeholder="RUKUN26" /><Button onClick={() => onJoin(code)}>Join campaign</Button></div></Card>; }
function NavButton({ label, active, onClick }) { return <button onClick={onClick} className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-black ${active ? "bg-[#967a4a] text-white shadow" : "bg-white/80 text-stone-700 hover:bg-white"}`}><span className="max-w-full text-center leading-tight">{label}</span></button>; }

function OrganizerDashboard(props) {
  const nav = [["orgHome", "Home"], ["schedule", "Schedule"], ["ann", "Announcements"], ["att", "Attendance"], ["info", "Info"]];
  return <div className="grid gap-4">
    <section>{props.screen === "schedule" ? <SchedulePanel {...props} /> : props.screen === "ann" ? <AnnouncementPanel {...props} /> : props.screen === "att" ? <AttendancePanel {...props} /> : props.screen === "info" ? <CampaignInfoPanel {...props} /> : <OrgHome {...props} />}</section>
    <aside className="absolute bottom-4 left-4 right-4 z-40 grid grid-cols-5 gap-1.5 rounded-[2rem] bg-white/95 p-2.5 shadow-2xl backdrop-blur">
      {nav.map(([id, label]) => <NavButton key={id} label={label} active={props.screen === id} onClick={() => props.setScreen(id)} />)}
    </aside>
  </div>;
}
function OrgHome({ campaign, pilgrims, db, setScreen }) { const counts = { schedule: db.scheduleItems.filter(s => s.campaignId === campaign.id).length, ann: db.announcements.filter(a => a.campaignId === campaign.id).length, trips: db.trips.filter(t => t.campaignId === campaign.id).length }; return <div className="grid gap-6"><Metric label="Registered pilgrims" value={pilgrims.length} /><Metric label="Schedule items" value={counts.schedule} /><Metric label="Trips" value={counts.trips} /><Card className="p-6"><h2 className="text-2xl font-black">Organizer dashboard</h2><p className="mt-2 text-lg text-stone-600">Create schedules, post announcements, track bus attendance, print bracelets, and edit campaign details.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setScreen("schedule")}>Manage schedule</Button><Button onClick={() => setScreen("ann")}>Post announcement</Button><Button onClick={() => setScreen("att")}>Track attendance</Button></div></Card></div>; }
function Metric({ label, value }) { return <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-base text-stone-500">{label}</p><p className="text-2xl font-black">{value}</p></div></div></Card>; }
function SchedulePanel({ db, campaign, addSchedule, updateSchedule, deleteSchedule }) { const [name, setName] = useState(""); const [time, setTime] = useState(""); const items = db.scheduleItems.filter(s => s.campaignId === campaign.id).sort((a, b) => new Date(a.time) - new Date(b.time)); return <Card className="p-6"><h2 className="mb-4 text-2xl font-black">Schedule Management</h2><div className="mb-6 grid gap-4"><Input label="Activity name" value={name} onChange={e => setName(e.target.value)} /><Input label="Time" type="datetime-local" value={time} onChange={e => setTime(e.target.value)} /><Button className="self-end" onClick={() => { addSchedule(name, time); setName(''); setTime('') }}>Add</Button></div><div className="grid gap-3">{items.map(item => <EditableSchedule key={item.id} item={item} updateSchedule={updateSchedule} deleteSchedule={deleteSchedule} />)}</div></Card>; }
function EditableSchedule({ item, updateSchedule, deleteSchedule }) { const [edit, setEdit] = useState(false); const [name, setName] = useState(item.activityName); const [time, setTime] = useState(item.time); return <div className="rounded-2xl bg-stone-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2">{edit ? <div className="grid flex-1 gap-2"><input className="rounded-lg border px-2 py-1" value={name} onChange={e => setName(e.target.value)} /><input className="rounded-lg border px-2 py-1" type="datetime-local" value={time} onChange={e => setTime(e.target.value)} /></div> : <div><p className="font-bold">{item.activityName}</p><p className="text-base text-stone-600">{fmtTime(item.time)}</p></div>}<div className="flex gap-2"><Button variant="soft" onClick={() => { if (edit) updateSchedule(item.id, { activityName: name, time }); setEdit(!edit); }}>{edit ? "Save" : "Edit"}</Button><Button variant="danger" onClick={() => deleteSchedule(item.id)}>Delete</Button></div></div></div>; }
function AnnouncementPanel({ db, campaign, postAnnouncement }) { const [content, setContent] = useState(""); const anns = db.announcements.filter(a => a.campaignId === campaign.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); return <Card className="p-6"><h2 className="mb-4 text-2xl font-black">Announcement Management</h2><Textarea label="Write new announcement" value={content} onChange={e => setContent(e.target.value)} /><Button className="mt-3" onClick={() => { postAnnouncement(content); setContent('') }}>Post and notify</Button><div className="mt-6 grid gap-2">{anns.map(a => <div key={a.id} className="rounded-2xl bg-stone-50 p-4"><p>{a.content}</p><p className="mt-2 text-sm text-stone-500">{fmtTime(a.timestamp)}</p></div>)}</div></Card>; }
function AttendancePanel({ db, campaign, pilgrims, createTrip, scanPilgrim }) { const [name, setName] = useState(""); const [dateTime, setDateTime] = useState(""); const [selected, setSelected] = useState(db.trips.find(t => t.campaignId === campaign.id)?.id || ""); const [qr, setQr] = useState(""); const trips = db.trips.filter(t => t.campaignId === campaign.id); const trip = trips.find(t => t.id === selected) || trips[0]; const checked = trip ? pilgrims.filter(p => trip.checkedInUserIds.includes(p.id)) : []; const missing = trip ? pilgrims.filter(p => !trip.checkedInUserIds.includes(p.id)) : []; return <div className="grid gap-4"><Card className="p-6"><h2 className="mb-4 text-2xl font-black">Create Trip</h2><div className="grid gap-3"><Input label="Trip name" value={name} onChange={e => setName(e.target.value)} /><Input label="Date/time" type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} /><Button className="self-end" onClick={() => { createTrip(name, dateTime); setName(''); setDateTime('') }}>Create</Button></div></Card><Card className="p-6"><h2 className="mb-4 text-2xl font-black">Record Attendance</h2><select className="mb-4 w-full rounded-2xl border px-4 py-3 text-base" value={trip?.id || ""} onChange={e => setSelected(e.target.value)}>{trips.map(t => <option key={t.id} value={t.id}>{t.name} · {fmtTime(t.dateTime)}</option>)}</select>{trip && <><div className="mb-4 rounded-xl bg-stone-50 p-4"><p className="text-2xl font-black">{checked.length} / {pilgrims.length}</p><p className="text-base text-stone-600">pilgrims checked in</p></div><div className="grid gap-2"><Input label="Scan pilgrim QR code" value={qr} onChange={e => setQr(e.target.value)} placeholder="Example: PILGRIM-u_p1" /><Button className="self-end" onClick={() => { scanPilgrim(trip.id, qr); setQr('') }}>Scan</Button></div><div className="mt-4 grid gap-4"><List title="Checked-in pilgrims" people={checked} /><List title="Missing pilgrims" people={missing} /></div></>}</Card></div>; }
function List({ title, people }) { return <div className="rounded-2xl bg-stone-50 p-4"><h3 className="mb-2 font-black">{title}</h3><div className="grid gap-3">{people.length ? people.map(p => <div key={p.id} className="flex items-center justify-between rounded-lg bg-white p-2 text-sm"><span>{p.fullName}</span><Badge>{p.pilgrimQr || "No QR"}</Badge></div>) : <p className="text-base text-stone-500">No names.</p>}</div></div>; }
function CampaignInfoPanel({ campaign, pilgrims, editCampaign, endCampaign, printBracelet }) { const [name, setName] = useState(campaign.name); const [phone, setPhone] = useState(campaign.emergencyPhone); return <div className="grid gap-4"><Card className="p-6"><h2 className="mb-4 text-2xl font-black">Campaign Information</h2><div className="grid gap-4"><FakeQR value={campaign.qr} /><div><p><b>Name:</b> {campaign.name}</p><p><b>Join code:</b> {campaign.joinCode}</p><p><b>Emergency phone:</b> {campaign.emergencyPhone}</p><Button className="mt-3" variant="soft" onClick={() => navigator.clipboard?.writeText(campaign.joinCode)}>Copy join code</Button></div></div></Card><Card className="p-6"><h3 className="mb-3 text-2xl font-black">Edit campaign</h3><div className="grid gap-3"><Input label="Campaign name" value={name} onChange={e => setName(e.target.value)} /><Input label="Emergency phone" value={phone} onChange={e => setPhone(e.target.value)} /><Button className="self-end" onClick={() => editCampaign({ name, emergencyPhone: phone })}>Save</Button></div></Card><Card className="p-6"><h3 className="mb-3 text-2xl font-black">Registered pilgrims and bracelets</h3><div className="grid gap-3">{pilgrims.map(p => <div key={p.id} className="grid gap-3 rounded-2xl bg-stone-50 p-4"><div><p className="font-bold">{p.fullName}</p><p className="text-sm text-stone-500">QR: {p.pilgrimQr}</p></div><div className="flex items-center justify-between gap-3"><FakeQR value={p.pilgrimQr} small /><Button className="text-xs" onClick={() => printBracelet(p)}>Print bracelet</Button></div></div>)}</div></Card><Button variant="danger" onClick={endCampaign}>End campaign and unlink users</Button></div>; }

function PilgrimDashboard(props) {
  const notificationCount = props.db.notifications.filter((n) => n.userId === props.currentUser.id).length;

  const goToScreen = (id) => {
    if (props.screen === "pNotifications" && id !== "pNotifications") {
      props.clearNewNotifications?.();
    }
    props.setScreen(id);
  };

  const nav = [
    ["pilgrimHome", "Home"],
    ["pSchedule", "Schedule"],
    ["pAnn", "Announcements"],
    ["pNotifications", notificationCount ? `Notifications (${notificationCount})` : "Notifications"],
    ["chat", "Ask"],
    ["emergency", "Emergency Call"],
  ];

  return <div className="grid gap-4">
    <section>
      {props.screen === "pSchedule" ? <PilgrimSchedule {...props} /> :
        props.screen === "pAnn" ? <PilgrimAnnouncements {...props} /> :
          props.screen === "pNotifications" ? <PilgrimNotifications {...props} /> :
            props.screen === "chat" ? <Chatbot /> :
              props.screen === "emergency" ? <EmergencyPanel {...props} /> :
                <PilgrimHome {...props} />}
    </section>
    <aside className="absolute bottom-4 left-4 right-4 z-40 grid grid-cols-3 gap-2 rounded-[2rem] bg-white/95 p-2.5 shadow-2xl backdrop-blur">
      {nav.map(([id, label]) => <NavButton key={id} label={label} active={props.screen === id} onClick={() => goToScreen(id)} />)}
    </aside>
  </div>;
}
function PilgrimHome({ db, currentUser, campaign, setScreen }) {
  return <div className="grid gap-4">
    <Card className="p-6">
      <h2 className="text-2xl font-black">Hi {currentUser.fullName}</h2>
      <p className="text-stone-600">You are linked to {campaign.name}. Use your pilgrim QR for attendance tracking.</p>
      <div className="mt-5 grid justify-items-center gap-3 rounded-3xl bg-stone-50 p-5">
        <FakeQR value={currentUser.pilgrimQr} />
        <div className="text-center">
          <p className="text-sm text-stone-500">Your QR value</p>
          <p className="break-all font-mono text-sm">{currentUser.pilgrimQr}</p>
        </div>
      </div>
    </Card>
  </div>;
}
function PilgrimSchedule({ db, campaign }) { const items = db.scheduleItems.filter(s => s.campaignId === campaign.id).sort((a, b) => new Date(a.time) - new Date(b.time)); const grouped = items.reduce((acc, i) => { const day = new Date(i.time).toLocaleDateString([], { dateStyle: "full" }); (acc[day] ||= []).push(i); return acc; }, {}); return <Card className="p-6"><h2 className="mb-4 text-2xl font-black">Daily Timeline</h2>{Object.entries(grouped).map(([day, items]) => <div key={day} className="mb-5"><h3 className="mb-2 font-black text-[#967a4a]">{day}</h3><div className="grid gap-3">{items.map(i => <div key={i.id} className="rounded-2xl bg-stone-50 p-4"><p className="font-bold">{i.activityName}</p><p className="text-base text-stone-600">{new Date(i.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>)}</div></div>)}</Card>; }
function PilgrimAnnouncements({ db, campaign }) { const anns = db.announcements.filter(a => a.campaignId === campaign.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); return <Card className="p-6"><h2 className="mb-4 text-2xl font-black">Announcements</h2><div className="grid gap-3">{anns.map(a => <div key={a.id} className="rounded-2xl bg-stone-50 p-4"><p>{a.content}</p><p className="mt-2 text-sm text-stone-500">{fmtTime(a.timestamp)}</p></div>)}</div></Card>; }
function PilgrimNotifications({ db, currentUser }) {
  const notifications = db.notifications
    .filter((n) => n.userId === currentUser.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return <Card className="p-6">
    <div className="mb-4">
      <h2 className="text-2xl font-black">Notifications</h2>
      <p className="text-base text-stone-600">
        {notifications.length
          ? `${notifications.length} new announcement notification${notifications.length === 1 ? "" : "s"}. These will disappear after you leave this tab.`
          : "No new notifications."}
      </p>
    </div>
    <div className="grid gap-3">
      {notifications.length ? notifications.map((n) => (
        <div key={n.id} className="rounded-xl bg-[#fff7df] p-3 ring-1 ring-[#d7b46a]">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="font-black">{n.title || "New announcement"}</p>
            <Badge>New</Badge>
          </div>
          <p>{n.content}</p>
          <p className="mt-2 text-sm text-stone-500">{fmtTime(n.timestamp)}</p>
        </div>
      )) : null}
    </div>
  </Card>;
}
function Chatbot() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Ask me general informational questions about Hajj rituals.",
    },
  ]);

  async function sendQuestion() {
    if (!q.trim()) return;

    const userQuestion = q;
    setQ("");
    setLoading(true);

    setMessages((old) => [
      ...old,
      { from: "user", text: userQuestion },
      { from: "bot", text: "Thinking..." },
    ]);

    try {
      const res = await fetch("http://localhost:3001/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
        }),
      });

      const data = await res.json();

      setMessages((old) => [
        ...old.slice(0, -1),
        {
          from: "bot",
          text: data.answer || data.error || "No answer returned.",
        },
      ]);
    } catch (error) {
      setMessages((old) => [
        ...old.slice(0, -1),
        {
          from: "bot",
          text: "The AI chatbot is currently unavailable. Make sure npm run server is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-2xl font-black">Ask Hajj Questions</h2>

      <div className="mb-5 h-72 overflow-auto rounded-2xl bg-stone-50 p-4">
        <div className="grid gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl p-4 text-base ${m.from === "bot"
                ? "bg-white"
                : "ml-auto bg-[#967a4a] text-white"
                }`}
            >
              {m.text}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Input
          label="Type your message"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendQuestion();
          }}
        />

        <Button className="self-end" onClick={sendQuestion} disabled={loading}>
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>
    </Card>
  );
}
function EmergencyPanel({ campaign, callEmergency }) { return <Card className="mx-auto max-w-full p-6 text-center"><h2 className="text-2xl font-black mb-3">Emergency Call</h2><p className="mt-2 text-stone-600">Campaign emergency phone number:</p><p className="my-4 text-2xl font-black">{campaign.emergencyPhone}</p><Button variant="danger" onClick={callEmergency}>Open phone dialer</Button></Card>; }
