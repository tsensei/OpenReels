const stages = [
	{
		name: "Research",
		desc: "Web search for facts",
		color: "bg-blue-500",
	},
	{
		name: "Director",
		desc: "Scene breakdowns + arc",
		color: "bg-purple-500",
	},
	{
		name: "Voiceover",
		desc: "TTS + word timestamps",
		color: "bg-green-500",
	},
	{
		name: "Visuals",
		desc: "AI images, video + stock",
		color: "bg-orange-500",
	},
	{
		name: "Music",
		desc: "AI + bundled score",
		color: "bg-pink-500",
	},
	{
		name: "Assembly",
		desc: "Remotion MP4 render",
		color: "bg-red-500",
	},
	{
		name: "Critic",
		desc: "AI quality check",
		color: "bg-yellow-500",
	},
];

export function PipelineDiagram() {
	return (
		<div className="my-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
			{stages.map((stage, i) => (
				<div key={stage.name} className="flex items-center">
					<div className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700">
						<div
							className={`h-3 w-3 rounded-full ${stage.color}`}
						/>
						<div>
							<div className="text-sm font-semibold">
								{stage.name}
							</div>
							<div className="text-xs text-neutral-500 dark:text-neutral-400">
								{stage.desc}
							</div>
						</div>
					</div>
					{i < stages.length - 1 && (
						<span className="hidden px-1 text-neutral-400 sm:inline">
							→
						</span>
					)}
				</div>
			))}
		</div>
	);
}
