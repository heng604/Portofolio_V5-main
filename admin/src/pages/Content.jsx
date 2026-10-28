import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Projects from "./content/Projects";
import Certificates from "./content/Certificates";
import TechStack from "./content/TechStack";
import Settings from "./content/Settings";
import Translations from "./content/Translations";
import Comments from "./content/Comments";
import Messages from "./content/Messages";

const TABS = [
  ["projects", "Projects"], ["texts", "Hero, About & text"], ["techstack", "Skills & tech"], ["certificates", "Certificates"],
  ["translations", "Translations"], ["comments", "Comments"], ["messages", "Messages"],
];

export default function Content() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Portfolio content</h1>
        <p className="text-sm text-gray-400">Create, edit, publish/hide and delete everything shown on the public site. Saved changes are live on the next page load - no deployment needed.</p></div>
      <nav aria-label="Content sections" className="flex gap-1 overflow-x-auto pb-1 border-b border-white/10">
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={`/content/${to}`} className={({ isActive }) => `px-3 py-2 text-sm whitespace-nowrap rounded-t-lg border-b-2 ${isActive ? "border-indigo-400 text-white" : "border-transparent text-gray-400 hover:text-white"}`}>{label}</NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="/content/projects" replace />} />
        <Route path="projects" element={<Projects />} />
        <Route path="texts" element={<Settings title="Hero, About & portfolio text" groups={["Home", "About", "About stats", "Portfolio"]} />} />
        <Route path="techstack" element={<TechStack />} />
        <Route path="certificates" element={<Certificates />} />
        <Route path="translations" element={<Translations />} />
        <Route path="comments" element={<Comments />} />
        <Route path="messages" element={<Messages />} />
      </Routes>
    </div>
  );
}
