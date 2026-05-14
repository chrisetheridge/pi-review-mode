import type { ReviewFileSnapshot } from "../../model";

export interface DirectoryNode {
  type: "directory";
  name: string;
  path: string;
  children: TreeNode[];
}

export interface FileNode {
  type: "file";
  name: string;
  path: string;
  file: ReviewFileSnapshot;
}

export type TreeNode = DirectoryNode | FileNode;

export function buildTree(files: ReviewFileSnapshot[]) {
  const root: DirectoryNode = {
    type: "directory",
    name: "",
    path: "",
    children: []
  };

  for (const file of files) {
    const parts = file.path.split("/");
    let directory = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;

      if (isFile) {
        directory.children.push({ type: "file", name: part, path, file });
        return;
      }

      let child = directory.children.find(
        (node): node is DirectoryNode =>
          node.type === "directory" && node.name === part
      );
      if (!child) {
        child = { type: "directory", name: part, path, children: [] };
        directory.children.push(child);
      }
      directory = child;
    });
  }

  return root.children;
}

export function sortTree(nodes: TreeNode[]): TreeNode[] {
  return [...nodes]
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((node) =>
      node.type === "directory"
        ? { ...node, children: sortTree(node.children) }
        : node
    );
}

export function commentCountsByFile(comments: { filePath: string }[]) {
  return comments.reduce<Record<string, number>>((acc, comment) => {
    acc[comment.filePath] = (acc[comment.filePath] ?? 0) + 1;
    return acc;
  }, {});
}
