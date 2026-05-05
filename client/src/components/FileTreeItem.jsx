import React from 'react';
import {
    ChevronRightIcon,
    FileIcon,
    FolderIcon,
    FolderOpenIcon,
    FilePlusIcon,
    FolderPlusIcon,
    StarIcon,
} from './Icons';

const FileTreeItem = ({
    file,
    depth = 0,
    activeFileId,
    mainFileId,
    onSelect,
    onContextMenu,
    isExpanded,
    onToggleExpand,
    onCreateFile,
    onCreateFolder,
}) => {
    const isFolder = file.type === 'folder';
    const isActive = activeFileId === file._id;
    const isMain = mainFileId === file._id;

    const handleContextMenu = (e) => {
        e.preventDefault();
        onContextMenu(e, file);
    };

    return (
        <div
            className={`fileTreeItem ${isActive ? 'fileTreeItem--active' : ''} ${
                isFolder ? 'fileTreeItem--folder' : ''
            }`}
            style={{ paddingLeft: `${depth * 12 + 6}px` }}
            onClick={() => {
                if (isFolder) {
                    onToggleExpand(file._id);
                } else {
                    onSelect(file._id);
                }
            }}
            onContextMenu={handleContextMenu}
        >
            <span
                className={`fileTreeItemChevron ${isFolder && isExpanded ? 'fileTreeItemChevron--open' : ''}`}
            >
                {isFolder && <ChevronRightIcon />}
            </span>
            <span className="fileTreeItemIcon">
                {isFolder ? (isExpanded ? <FolderOpenIcon /> : <FolderIcon />) : <FileIcon />}
            </span>
            <span className="fileTreeItemName">{file.name}</span>
            {isMain && !isFolder && (
                <span className="fileTreeMainStar" title="Main File">
                    <StarIcon />
                </span>
            )}
            {isFolder && (
                <span className="fileTreeItemActions">
                    <button
                        className="fileTreeItemActionBtn"
                        title="New File"
                        onClick={(e) => {
  //Without stopPropagation(): 
 // The child tells the parent, the parent tells the grandparent, and the message keeps traveling.
                            e.stopPropagation();
                            onCreateFile(file._id);
                        }}
                    >
                        <FilePlusIcon />
                    </button>
                    <button
                        className="fileTreeItemActionBtn"
                        title="New Folder"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateFolder(file._id);
                        }}
                    >
                        <FolderPlusIcon />
                    </button>
                </span>
            )}
        </div>
    );
};

export default FileTreeItem;
