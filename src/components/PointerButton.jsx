export default function PointerButton({
  onClick,
  onMouseDown,
  onPointerDown,
  ...props
}) {
  const preventFocus = (event, handler) => {
    handler?.(event);
    if (!event.defaultPrevented) {
      event.preventDefault();
    }
  };

  return (
    <button
      {...props}
      tabIndex={-1}
      onPointerDown={(event) => preventFocus(event, onPointerDown)}
      onMouseDown={(event) => preventFocus(event, onMouseDown)}
      onClick={(event) => {
        event.currentTarget.blur();
        onClick?.(event);
      }}
    />
  );
}
