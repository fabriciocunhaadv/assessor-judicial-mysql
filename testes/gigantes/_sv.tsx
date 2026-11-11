import React from "react";
import { createRoot } from "react-dom/client";
import { instalarPonteSentencaVideo } from "../../src/utils/sentencaComVideo";
import { SentencaVideoSelo } from "../../src/components/SentencaVideoSelo";
createRoot(document.getElementById("root")!).render(<SentencaVideoSelo />);
instalarPonteSentencaVideo();
(window as any).pronto = true;
