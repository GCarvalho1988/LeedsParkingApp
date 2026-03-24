const KEY = 'parkingUserName';

export const getName  = () => sessionStorage.getItem(KEY);
export const setName  = (name) => sessionStorage.setItem(KEY, name);
export const clearName = () => sessionStorage.removeItem(KEY);
