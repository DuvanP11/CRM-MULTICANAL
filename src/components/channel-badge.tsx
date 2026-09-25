import ChannelLogo, { channelBrand, channelLabel } from "./channel-logo";

export default function ChannelBadge({
  channel,
  withLabel = true,
  size = 14,
}: {
  channel: string;
  withLabel?: boolean;
  size?: number;
}) {
  const color = channelBrand(channel);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 20,
        background: `${color}1a`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <ChannelLogo channel={channel} size={size} />
      {withLabel && channelLabel(channel)}
    </span>
  );
}