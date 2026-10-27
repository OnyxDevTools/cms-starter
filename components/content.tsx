// filename: components/content.tsx
import { Fragment, type ReactNode } from "react";
import {
  headings,
  type ContentNode,
  type Document,
  type Media,
} from "@/lib/domain";

export function SiteImage({
  media,
  priority = false,
  privateAsset = false,
}: {
  media: Media;
  priority?: boolean;
  privateAsset?: boolean;
}) {
  const prefix = privateAsset ? "preview=1&" : "";
  const sizes = [320, 640, 960, 1280, 1600].filter(
    (width) => width <= media.width,
  );
  if (!sizes.includes(media.width) && media.width < 1600)
    sizes.push(media.width);
  return (
    <img
      src={`/media/${media.id}?${prefix}w=${Math.min(media.width, 960)}`}
      srcSet={sizes
        .map((width) => `/media/${media.id}?${prefix}w=${width} ${width}w`)
        .join(", ")}
      sizes="(max-width: 760px) calc(100vw - 40px), 760px"
      width={media.width}
      height={media.height}
      alt={media.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className="content-image"
    />
  );
}
export function Content({
  document,
  media,
  preview = false,
}: {
  document: Document;
  media: Map<string, Media>;
  preview?: boolean;
}) {
  let heading = 0;
  const render = (node: ContentNode, key: string): ReactNode => {
    const children = node.children?.map((child, index) =>
      render(child, `${key}-${index}`),
    );
    switch (node.type) {
      case "root":
        return <Fragment key={key}>{children}</Fragment>;
      case "text":
      case "code-highlight": {
        let text: ReactNode = node.text || "";
        const flags = typeof node.format === "number" ? node.format : 0;
        if (flags & 1) text = <strong>{text}</strong>;
        if (flags & 2) text = <em>{text}</em>;
        if (flags & 4) text = <s>{text}</s>;
        if (flags & 8) text = <u>{text}</u>;
        if (flags & 16) text = <code>{text}</code>;
        return <Fragment key={key}>{text}</Fragment>;
      }
      case "paragraph":
        return <p key={key}>{children}</p>;
      case "heading": {
        const id = `section-${++heading}`;
        const Tag = node.tag === "h3" ? "h3" : node.tag === "h4" ? "h4" : "h2";
        return (
          <Tag key={key} id={id}>
            {children}
          </Tag>
        );
      }
      case "link":
        return (
          <a
            key={key}
            href={node.url}
            rel={
              node.url?.startsWith("http") ? "noopener noreferrer" : undefined
            }
          >
            {children}
          </a>
        );
      case "list":
        return node.listType === "number" ? (
          <ol key={key} start={node.start}>
            {children}
          </ol>
        ) : (
          <ul key={key}>{children}</ul>
        );
      case "listitem":
        return <li key={key}>{children}</li>;
      case "quote":
        return <blockquote key={key}>{children}</blockquote>;
      case "code":
        return (
          <pre key={key}>
            <code>{children}</code>
          </pre>
        );
      case "table":
        return (
          <div
            key={key}
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Content table"
          >
            <table>
              <tbody>{children}</tbody>
            </table>
          </div>
        );
      case "tablerow":
        return <tr key={key}>{children}</tr>;
      case "tablecell":
        return node.headerState ? (
          <th
            key={key}
            scope={node.headerState === 2 ? "row" : "col"}
            colSpan={node.colSpan}
            rowSpan={node.rowSpan}
          >
            {children}
          </th>
        ) : (
          <td key={key} colSpan={node.colSpan} rowSpan={node.rowSpan}>
            {children}
          </td>
        );
      case "linebreak":
        return <br key={key} />;
      case "image": {
        const image = media.get(node.mediaId || "");
        return image ? (
          <SiteImage
            key={key}
            privateAsset={preview}
            media={{ ...image, alt: node.alt || image.alt }}
          />
        ) : null;
      }
      default:
        return null;
    }
  };
  return <div className="prose">{render(document.root, "root")}</div>;
}
export function TableOfContents({ document }: { document: Document }) {
  const entries = headings(document);
  return entries.length ? (
    <nav aria-label="On this page" className="toc">
      <h2>On this page</h2>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`}>{entry.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  ) : null;
}
