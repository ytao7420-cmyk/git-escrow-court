const marks = [
  {
    src: "/logos/internet-court.svg",
    alt: "Internet Court",
    viewWidth: 222,
    viewHeight: 29,
    displayWidth: 214,
  },
  {
    src: "/logos/genlayer.svg",
    alt: "GenLayer",
    viewWidth: 385.32,
    viewHeight: 91.93,
    displayWidth: 134,
  },
  {
    src: "/logos/arkhai.svg",
    alt: "Arkhai",
    viewWidth: 162,
    viewHeight: 40,
    displayWidth: 130,
  },
];

export function Marks() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4" data-marks>
        {marks.map((mark) => (
          // width is derived from the file viewBox. flex-shrink stays 0 so a row cannot squash the mark.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={mark.alt}
            src={mark.src}
            alt={mark.alt}
            width={mark.viewWidth}
            height={mark.viewHeight}
            data-mark={mark.alt}
            data-ratio={(mark.viewWidth / mark.viewHeight).toFixed(4)}
            className="block max-w-full shrink-0 object-contain"
            style={{
              width: mark.displayWidth,
              height: "auto",
              aspectRatio: `${mark.viewWidth} / ${mark.viewHeight}`,
              objectFit: "contain",
            }}
          />
        ))}
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-5 text-muted-foreground">
        三个标识来自各自公开站点。显示宽度按文件 viewBox
        计算，容器使用 contain，不把圆形或六边形压成椭圆。它们只用于辨认涉及的项目，不表示 Internet Court、GenLayer
        或 Arkhai 背书、合作发布，或已接受本案。
      </p>
    </div>
  );
}
