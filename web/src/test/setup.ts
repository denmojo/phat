import '@testing-library/jest-dom/vitest';

// jsdom lays nothing out, so it has no scrollIntoView; browsers all do.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function scrollIntoView() {};
