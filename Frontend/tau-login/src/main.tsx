import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import "./styles/fonts.css";
import "./styles/redesign.css";
import "./styles/public.css";
import "./styles/navigation.css";
import "./styles/motion.css";
import "./styles/atlas.css";
import App from "./app/index";

const root = document.getElementById("root")!;
const app = <App />;

// In React 18 StrictMode, effects run twice in development (intentional).
// This can cause duplicate fetches and brief UI resets on pages with
// initial loads. Keep StrictMode in production, disable in dev to avoid flicker.
if (import.meta.env.PROD) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {app}
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(root).render(app);
}

