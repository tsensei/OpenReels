import { registerRoot } from "remotion";
import { OpenReelsVideo } from "./compositions/OpenReelsVideo";

// Re-export for programmatic rendering
export { OpenReelsVideo };

registerRoot(OpenReelsVideo);
