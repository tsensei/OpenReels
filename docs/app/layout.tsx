import { RootProvider } from "fumadocs-ui/provider";
import "fumadocs-ui/style.css";
import type { ReactNode } from "react";

export const metadata = {
	title: {
		template: "%s | OpenReels",
		default: "OpenReels — AI Video Pipeline",
	},
	description:
		"Open-source AI pipeline that turns any topic into a fully rendered YouTube Short. One command. Research, script, voiceover, visuals, music, captions, assembly.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}
