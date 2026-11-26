if(ANDROID_BUILD)initializeMobileInterface();
startInterface();

const paperclips={
 get game(){return game;},model:PaperclipModel,render,settings,
 get renderer(){return screenRenderer;},
 save,openModal,closeModal,setLanguage,previewTransition,previewDeparture
};
window.Paperclips=paperclips;
