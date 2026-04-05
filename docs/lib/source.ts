import { docs } from "@/.source";
import { loader } from "fumadocs-core/source";

const fumadocsSource = docs.toFumadocsSource();

// fumadocs-mdx types say `files` is an array, but runtime returns a function.
// Call the function to get the actual array.
const files = (fumadocsSource.files as unknown as () => typeof fumadocsSource.files)();

export const source = loader({
	source: { files },
	baseUrl: "/docs",
});
