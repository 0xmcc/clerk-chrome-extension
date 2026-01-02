import React from "react"
import ReactDOM from "react-dom/client"

import { SpacesApp } from "../../spaces/SpacesApp"

import "../../src/style.css"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SpacesApp routerMode="browser" />
  </React.StrictMode>
)
