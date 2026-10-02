/**
 * A real thumbnail-shaped JPEG: 32 x 18 (a hue ramp, a dark band, a white square), encoded by jpeg-js 0.4.4 at
 * quality 80, the encoder the server makes its thumbnails with (workers/api/src/slate/http/renditions.ts), 4:4:4.
 * The TypeScript twin of `mod/fixtures/thumb.mjs` (the node tests' copy); `mod-fixtures.test.mjs` keeps them equal.
 */
export const THUMB_JPEG: string =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYn' +
  'KSopGR8tMC0oMCUoKSgBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgo' +
  'KCgoKP/AABEIABIAIAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQEC' +
  'AwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVm' +
  'Z2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq' +
  '8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIy' +
  'gQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SF' +
  'hoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEA' +
  'AhEDEQA/APIorzSF63I/79t/hX6fi+IsHU+Gf4P/ACPFw1PEw+KP4r/MuRaloq9bsf8Afp/8K+ZxeY06nws+hw2KlD4i5FrGgr1v' +
  'R/36f/4mvmcW6tT4UfQ4bOKNP4pfgy5Fr/h1et+P+/Mn/wATXzOLwGNqfDD8V/mfQ4bibBU/iqfg/wDI7CHwfpp66bZn/tgv+Ffr' +
  'GNWHj8MEvkj+asJm9eW9Rv5svQ+DNKPXSrE/9u6f4V8njK8Y/DofTYTMJS3dzf8ADPw80HUNXt7a70qzWF924pbxg8KSOqnuK+dW' +
  'JnWrqlztJ32fkfS4bExa2TZu+Jfhf4Z0w2v2PSbSTzN27zbeM4xjGMKPU14fEdatl8YOlWn71/tPpbtbue/ltWlVbVSnHTyRUgVe' +
  'OB+VfrWObP5vwbZoQKvHA/Kvjcc3qfWYNs0YFX0H5V8bjm9T6zBtmhAq+g/KvjMe3qfV4Js//9k=';
export const THUMB_WIDTH: number = 32;
export const THUMB_HEIGHT: number = 18;
