import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { useEffect, useState, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import Navbar from "./components/Navbar";
import Home from "./Pages/Home";
import About from "./Pages/About";
import AnimatedBackground from "./components/Background";
import { AnimatePresence } from "framer-motion";
import Footer from "./components/Footer";
import TipJar from "./components/TipJar";
import { LanguageProvider, useLang } from "./lib/i18n";

import { useSettings } from "./lib/useSetting";

const Portofolio = lazy(() => import("./Pages/Portofolio"));
const ContactPage = lazy(() => import("./Pages/Contact"));
const ProjectDetails = lazy(() => import("./components/ProjectDetail"));
const WelcomeScreen = lazy(() => import("./Pages/WelcomeScreen"));
const NotFoundPage = lazy(() => import("./Pages/404"));

const TipSection = () => {
  const { t } = useLang();
  return (
    <section id="Tip" className="px-[5%] lg:px-[10%] py-16" aria-labelledby="tip-heading">
      <div className="text-center mb-8">
        <h2 id="tip-heading" className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a855f7]">{t("tip.title")}</h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base mt-2">{t("tip.subtitle")}</p>
      </div>
      <TipJar />
    </section>
  );
};

// The admin dashboard is a separate app (/admin). Old bookmarks to /login or /dashboard are forwarded.
const GoAdmin = () => {
  useEffect(() => { window.location.replace("/admin/"); }, []);
  return null;
};

const LandingPage = ({ showWelcome, setShowWelcome }) => {
  const settings = useSettings();
  const on = (key) => settings[key] !== "hidden"; // set from Admin > Appearance > Sections & visibility
  return (
    <>
      <AnimatePresence mode="wait">
        {showWelcome && (
          <Suspense fallback={null}>
            <WelcomeScreen onLoadingComplete={() => setShowWelcome(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {!showWelcome && (
        <>
          <Navbar />
      
          <Home />
          {on("section_about") && <About />}
          <Suspense fallback={<div className="h-20" />}>
            {on("section_portfolio") && <Portofolio />}
            {on("section_tip") && <TipSection />}
            {on("section_contact") && <ContactPage />}
          </Suspense>
          <Footer />
        </>
      )}
    </>
  );
};

const ProjectPageLayout = () => (
  <>
    <Suspense fallback={<div className="min-h-screen" />}>
      <ProjectDetails />
    </Suspense>
    <Footer />
  </>
);

function App() {
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    
    <LanguageProvider>
    <HelmetProvider>
      <div className="pointer-events-none">
  <AnimatedBackground />
</div>
      <BrowserRouter>
        <Routes>
          {/* PUBLIC */}
          <Route
            path="/"
            element={
              <LandingPage
                showWelcome={showWelcome}
                setShowWelcome={setShowWelcome}
              />
            }
          />

          <Route path="/project/:slug" element={<ProjectPageLayout />} />

          {/* Moved to the separate admin app */}
          <Route path="/login" element={<GoAdmin />} />
          <Route path="/dashboard/*" element={<GoAdmin />} />

          {/* 404 */}
          <Route
            path="*"
            element={
              <Suspense fallback={null}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
    </LanguageProvider>
  );
}

export default App;