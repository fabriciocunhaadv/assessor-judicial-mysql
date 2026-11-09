import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import "../../src/index.css";
import { AuthProvider } from "../../src/lib/AuthContext";
import { NovoChamadoCelular } from "../../src/components/NovoChamadoCelular";
createRoot(document.getElementById("root")!).render(<AuthProvider><Toaster /><NovoChamadoCelular /></AuthProvider>);
