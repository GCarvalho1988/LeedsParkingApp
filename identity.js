const KEY = 'parkingUserName';

export const getName  = () => localStorage.getItem(KEY);
export const setName  = (name) => localStorage.setItem(KEY, name);
export const clearName = () => localStorage.removeItem(KEY);
