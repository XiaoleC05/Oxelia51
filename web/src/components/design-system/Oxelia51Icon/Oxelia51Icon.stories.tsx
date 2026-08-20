import React from "react";
import preview from "../../../../.storybook/preview";
import { Oxelia51Icon } from "./Oxelia51Icon";

type ComponentProps = React.ComponentProps<typeof Oxelia51Icon>;
type Size = NonNullable<ComponentProps["size"]>;

const meta = preview.meta({
  component: Oxelia51Icon,
});

const allSizes = Object.keys({
  14: true,
  16: true,
  28: true,
  32: true,
  42: true,
} satisfies Record<Size, true>).map(Number) as Size[];

export const Default = meta.story({
  args: {
    size: 32,
  },
});

export const AllSizes = meta.story({
  render: () => (
    <div className="flex items-end gap-6 p-2">
      {allSizes.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Oxelia51Icon size={size} />
          <span className="text-muted-foreground text-xs">{size}px</span>
        </div>
      ))}
    </div>
  ),
});
