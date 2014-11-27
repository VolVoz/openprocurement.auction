angular.module('auction')
  .config(['$translateProvider', function($translateProvider) {
    $translateProvider.translations('en', {
      'Announcement': 'Announcement',
      'Bid': 'Bid',
      'Bidder': 'Bidder',
      'Bidding': 'Bidding',
      'English': 'English',
      'Russian': 'Russian',
      'Ukrainian': 'Ukrainian',
      'Edit': 'Edit',
      'Info': 'Info',
      'Initial bids': 'Initial bids',
      'Login in as viewer': 'Login in as viewer',
      'Login in as': 'Login in as',
      'Place a bid': 'Place a bid',
      'Preliminary bids': 'Preliminary bids',
      'Round': 'Round',
      'Settings': 'Settings',
      'Time': 'Time',
      'You': 'You',
      'All bidders': 'All bidders',
      'Pause': 'Pause',
      'Results Release': 'Results Release',
      'or lower': 'or lower',
      'UAH': 'UAH',
      'shortTime': 'h:mm a',
      'Restart sync': 'Restart sync',
      'To low value': 'To low value',
      'To high value': 'To high value',
      'Not valid bidder': 'Not valid bidder',
      'Stage not for bidding': 'Stage not for bidding',
      'Bid placed': 'Bid placed',
      'Your proposal': 'Your proposal :',
      'Finish': 'Finish',
      'days': 'days',
      'hours': 'hr',
      'minutes': 'min',
      'seconds': 'sec',
      'minimum': 'minimum',
      'until the auction starts': 'until the auction starts',
      'after the auction was completed': 'after the auction was completed',
      'until the round starts': 'until the round starts',
      'Internet connection is lost. Attempt to restart after 1 sec': 'Internet connection is lost. Attempt to restart after 1 sec',
      'Synchronization failed': 'Synchronization failed',
      'Possible results': 'Possible results'
    });

    $translateProvider.translations('uk', {
      'Announcement': 'Оголошення результатів',
      'Bid': 'Заявка',
      'Bidder': 'Учасник',
      'Bidding': 'Торги',
      'English': 'Англійська',
      'Russian': 'Російська',
      'Ukrainian': 'Українська',
      'Edit': 'Змінити',
      'Info': 'Інформація',
      'Initial bids': 'Початкові заявки',
      'Login in as viewer': 'Вхід в якості глядача',
      'Login in as': 'Вхід в якості ',
      'Place a bid': 'Зробити заявку',
      'Preliminary bids': 'Попередні заявки',
      'Round': 'Раунд',
      'Settings': 'Налаштування',
      'Time': 'Час',
      'You': 'Ви',
      'All bidders': 'Всі учасники торгів',
      'Pause': 'Пауза',
      'Results Release': 'Результати',
      'or lower': 'або менше',
      'UAH': 'грн',
      'shortTime': 'HH:mm',
      'Restart sync': 'Перезапуск синхронізації',
      'To low value': 'Надто низька заявка',
      'To high value': 'Надто висока заявка',
      'Not valid bidder': 'Ви не є валідний користувачем',
      'Stage not for bidding': 'Даний етап аукціону не передбачає приймання заявок',
      'Bid placed': 'Заявку прийнято',
      'Your proposal :': 'Ваша заявка:',
      'Finish': 'Завершено',
      'days': 'днів',
      'hours': 'год',
      'minutes': 'хв',
      'seconds': 'сек',
      'minimum': 'мінімум',
      'until the auction starts': 'до початку аукціону',
      'after the auction was completed': 'після завершення аукціону',
      'until the round starts': 'до початку наступного раунду',
      'Internet connection is lost. Attempt to restart after 1 sec': 'З\'єднання з інтернетом втрачено. спроба перезавантаження через 1 сек',
      'Synchronization failed': 'Помилка синхронізації',
      'Possible results': 'Можливі результати'
    });

    $translateProvider.translations('ru', {
      'Announcement': 'Объявление результатов',
      'Bid': 'Ставка',
      'Bidder': ' Участник',
      'Bidding': 'Торги',
      'English': 'Английский',
      'Russian': 'Русский',
      'Ukrainian': 'Украинский',
      'Edit': 'Изменить',
      'Info': 'Информация',
      'Initial bids': 'Первоначальные ставки',
      'Login in as viewer': 'Вход в качестве зрителя',
      'Login in as': 'Вход в качестве',
      'Place a bid': 'Сделать ставку',
      'Preliminary bids': 'Предварительные ставки',
      'Round': 'Раунд',
      'Settings': 'Настройки',
      'Time': 'Время',
      'You': 'Вы',
      'All bidders': 'Все участники торгов',
      'Pause': 'Пауза',
      'Results Release': 'Результаты',
      'or lower': 'или меньше',
      'UAH': 'грн',
      'shortTime': 'HH:mm',
      'Restart sync': 'Перезапуск синхронизации',
      'To low value': 'Слишком низкая ставка',
      'To high value': 'Слишком высокая ставка',
      'Not valid bidder': ' Вы не являетесь валидный пользователем',
      'Stage not for bidding': 'Данный этап аукциона не предусматривает приема ставок',
      'Bid placed': 'Ставку принято',
      'Your proposal :': 'Ваше предложение:',
      'Finish': 'Окончен',
      'days': 'дней',
      'hours': 'час',
      'minutes': 'мин',
      'seconds': 'сек',
      'minimum': 'минимум',
      'until the auction starts': 'до начала аукциона',
      'after the auction was completed': 'после окончания аукциона',
      'until the round starts': 'до начала раунда',
      'Internet connection is lost. Attempt to restart after 1 sec': 'Cоединения с интернетом потеряно. попытка перезагрузки через 1 сек',
      'Synchronization failed': 'Ошибка синхронизации',
      'Possible results': 'Возможные результаты'
    });
    $translateProvider.preferredLanguage('uk');
  }])