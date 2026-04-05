import defaultMdxComponents from "fumadocs-ui/mdx";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/page";
import type { TableOfContents } from "fumadocs-core/server";
import { notFound } from "next/navigation";
import { source } from "@/lib/source";

interface MdxPageData {
	title: string;
	description?: string;
	// biome-ignore lint: MDX component accepts arbitrary props
	body: any;
	toc: TableOfContents;
}

interface PageProps {
	params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	const data = page.data as unknown as MdxPageData;
	const MDX = data.body;

	return (
		<DocsPage toc={data.toc}>
			<DocsTitle>{data.title}</DocsTitle>
			<DocsDescription>{data.description}</DocsDescription>
			<DocsBody>
				<MDX components={{ ...defaultMdxComponents }} />
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return source.generateParams();
}

export async function generateMetadata(props: PageProps) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	return {
		title: page.data.title,
		description: page.data.description,
	};
}
