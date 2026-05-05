import React from 'react';

/*
 * Shared line-icon set (24px grid, 1.75 stroke, currentColor).
 * Replaces the emoji that were used as UI icons — emoji render differently on
 * every OS and are the fastest way to make an interface look unfinished.
 */
const Svg = ({ size = 16, children, ...rest }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
    >
        {children}
    </svg>
);

export const FileIcon = (p) => (
    <Svg {...p}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
    </Svg>
);

export const FolderIcon = (p) => (
    <Svg {...p}>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
);

export const FolderOpenIcon = (p) => (
    <Svg {...p}>
        <path d="M3 17V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" />
        <path d="M3 17l2.2-6.6A2 2 0 0 1 7.1 9H20a1 1 0 0 1 .95 1.3l-2 6.3A2 2 0 0 1 17 18H4a1 1 0 0 1-1-1z" />
    </Svg>
);

export const ChevronRightIcon = (p) => (
    <Svg {...p}>
        <path d="M9 6l6 6-6 6" />
    </Svg>
);

export const FilePlusIcon = (p) => (
    <Svg {...p}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M12 11v6M9 14h6" />
    </Svg>
);

export const FolderPlusIcon = (p) => (
    <Svg {...p}>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M12 10v6M9 13h6" />
    </Svg>
);

export const PencilIcon = (p) => (
    <Svg {...p}>
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
        <path d="M13.5 6.5l4 4" />
    </Svg>
);

export const TrashIcon = (p) => (
    <Svg {...p}>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
);

export const StarIcon = (p) => (
    <Svg {...p}>
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </Svg>
);

export const BookIcon = (p) => (
    <Svg {...p}>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 19V5M19 19v2H6" />
    </Svg>
);

export const BugIcon = (p) => (
    <Svg {...p}>
        <rect x="7" y="8" width="10" height="12" rx="5" />
        <path d="M12 12v8M9 4l1.5 2M15 4l-1.5 2M3 13h4M17 13h4M4 19l3-2M20 19l-3-2M4 8l3 2M20 8l-3 2" />
    </Svg>
);

export const WandIcon = (p) => (
    <Svg {...p}>
        <path d="M4 20L15 9M13 7l2-2 4 4-2 2z" />
        <path d="M19 3v2M18 4h2M6 3v2M5 4h2M20 14v2M19 15h2" />
    </Svg>
);

export const SearchIcon = (p) => (
    <Svg {...p}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
    </Svg>
);

export const XIcon = (p) => (
    <Svg {...p}>
        <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
);

export const CheckIcon = (p) => (
    <Svg {...p}>
        <path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
);

export const AgentIcon = (p) => (
    <Svg {...p}>
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M12 3v4M9 12v1M15 12v1M9.5 16h5" />
    </Svg>
);

export const ZapIcon = (p) => (
    <Svg {...p}>
        <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />
    </Svg>
);

export const WrenchIcon = (p) => (
    <Svg {...p}>
        <path d="M14.5 6.5a4 4 0 0 0 5 5l-8.5 8.5a2.1 2.1 0 0 1-3-3L16.5 8.5" />
        <path d="M14.5 6.5L17 4a4 4 0 0 1 3 3l-2.5 2.5" />
    </Svg>
);

export const UserIcon = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
);

export const AlertIcon = (p) => (
    <Svg {...p}>
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4M12 17.5v.01" />
    </Svg>
);

export const LayersIcon = (p) => (
    <Svg {...p}>
        <path d="M12 3l9 5-9 5-9-5z" />
        <path d="M3 13l9 5 9-5" />
    </Svg>
);

export const ArrowRightIcon = (p) => (
    <Svg {...p}>
        <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
);

export const VideoIcon = (p) => (
    <Svg {...p}>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="M16 10l5-3v10l-5-3" />
    </Svg>
);

export const BellIcon = (p) => (
    <Svg {...p}>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
);
