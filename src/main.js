import { createApp, h } from "vue";
import "./styles.css";

createApp({
  render() {
    return h("main", { class: "preview-shell" }, [
      h("h1", "Thunderbird Add-ons"),
      h(
        "p",
        "Run npm run generate, then serve build/ to view generated add-on listing pages."
      ),
    ]);
  },
}).mount("#app");
