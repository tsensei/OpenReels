"use client";

import { useState } from "react";

interface CLIExampleProps {
	command: string;
	description?: string;
}

export function CLIExample({ command, description }: CLIExampleProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(command);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="group relative my-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
			{description && (
				<div className="border-b border-neutral-200 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
					{description}
				</div>
			)}
			<div className="flex items-center gap-2 bg-neutral-50 px-4 py-3 font-mono text-sm dark:bg-neutral-900">
				<span className="select-none text-neutral-400">$</span>
				<code className="flex-1">{command}</code>
				<button
					type="button"
					onClick={handleCopy}
					className="rounded p-1 text-neutral-400 opacity-0 transition hover:text-neutral-600 group-hover:opacity-100 dark:hover:text-neutral-300"
					aria-label="Copy command"
				>
					{copied ? "Copied!" : "Copy"}
				</button>
			</div>
		</div>
	);
}
