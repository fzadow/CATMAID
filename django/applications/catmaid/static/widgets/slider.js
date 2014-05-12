/**
 * simple slider
 */

var SLIDER_HORIZONTAL = 0;
var SLIDER_VERTICAL = 1;

/**
 * a vertical or horizontal slider
 *
 * it is possible to instantiate the slider by the values min, max and steps or
 * with an array steps containing all possible values
 * internally a steps-array is created for both constructors
 */
Slider = function(
  type,     //!< SLIDER_HORIZONTAL | SLIDER_VERTICAL
  input,    //!< create an input or not
  min,      //!< the minimal value
  max,      //!< the maximal value
  steps,    //!< number of steps or an array of values
  def,      //!< default value
  onchange,  //!< method to call
  split     //!< split value
  )
{
  /**
   * returns the slider-element for insertion to the document
   */
  this.getView = function()
  {
    return view;
  }
  
  /**
   * returns the input-element for insertion to the document
   */
  this.getInputView = function()
  {
    return inputView;
  }
  
  /**
   * set a value by its index in the value array
   */
  var setByIndex = function( i, cancelOnchange )
  {
    if ( values.length > 1 )
      handlePos = i / ( values.length - 1 ) * barSize;
    else
      handlePos = 0;
    switch ( type )
    {
    case SLIDER_VERTICAL:
      barTop.style.height = ( handlePos + handleTop ) + "px";
      barBottom.style.height = ( barSize - handlePos + handleBottom ) + "px";
      // select CSS class
      if (i < splitIndex) {
        barTop.className = "vSliderBarTop";
        barBottom.className = "vSliderBarBottom";
      } else {
        barTop.className = "vSliderBarTop_2";
        barBottom.className = "vSliderBarBottom_2";
      }
      break;
    case SLIDER_HORIZONTAL:
      var w = Math.floor( handlePos + handleSize / 2 );
      handle.style.left = ( handlePos + handleTop ) + "px";
      barTop.style.width = ( w + handleTop ) + "px";
      barBottom.style.width = ( barSize - w + handleSize + handleBottom ) + "px";
      // select CSS class
      if (i < splitIndex) {
        barTop.className = "hSliderBarTop";
        barBottom.className = "hSliderBarBottom";
      } else {
        barTop.className = "hSliderBarTop_2";
        barBottom.className = "hSliderBarBottom_2";
      }
      break;
    }
    self.val = values[ i ];
    if ( input )
    {
      input.value = self.val;
    }
    ind = i;
    
    if ( !cancelOnchange ) self.onchange( self.val );
    
    return;
  }
  
  /**
   * set a value, priorly check if it is in the value array
   */
  this.setByValue = function( val, cancelOnchange )
  {
    var i = isValue( val );
    if ( i > -1 )
    {
      setByIndex( i, cancelOnchange );
    }
    return;
  }
  
  /**
   * set a value, priorly check if it is in the value array
   */
  var setByInput = function( e )
  {
    var i = isValue( this.value );
    if ( i > -1 )
    {
      setByIndex( i );
    }
    else
    {
      this.value = self.val;
    }
    return;
  }
  
  /**
   * check if a value is in the value array
   *
   * @returns -1 if not, the index of the value otherwise
   */
  var isValue = function( val )
  {
    for ( var i = 0; i < values.length; ++i )
    {
      if ( values[ i ] == val )
        return i;
    }
    return -1;
  }
  
  /**
   * mouse button pressed on handle
   */
  var handleMouseDown = function( e )
  {
    virtualHandlePos = handlePos;
    
    ui.registerEvent( "onmousemove", handleMove );
    ui.registerEvent( "onmouseup", handleMouseUp );
    ui.setCursor( "pointer" );
    ui.catchEvents();
    ui.onmousedown( e );
    
    return false;
  }
  
  /**
   * mouse button released on handle (on the ui.mouseCatcher respectively)
   */
  var handleMouseUp = function( e )
  {
    if ( timer ) window.clearTimeout( timer );
    
    ui.releaseEvents()
    ui.removeEvent( "onmousemove", handleMove );
    ui.removeEvent( "onmouseup", handleMouseUp );
    
    return false;
  }
  
  /**
   * mouse moved on handle (on the mouseCatcher respectively)
   */
  var handleMove = function( e )
  {
    var md;
    switch ( type )
    {
    case SLIDER_VERTICAL:
      md = ui.diffY;
      break;
    case SLIDER_HORIZONTAL:
      md = ui.diffX;
      break;
    }
    virtualHandlePos = Math.max( 0, Math.min( barSize, virtualHandlePos + md ) );
    var i = Math.round( virtualHandlePos / barSize * ( values.length - 1 ) );
    setByIndex( i );
    
    return false;
  }
  
  /**
   * mouse wheel over slider, moves the slider step by step
   */
  var mouseWheel = function( e )
  {
    var w = ui.getMouseWheel( e );
    if ( w )
    {
      if ( type == SLIDER_HORIZONTAL ) w *= -1;
      if ( w > 0 )
      {
        setByIndex( Math.min( values.length - 1, ind + 1 ) );
      }
      else
      {
        setByIndex( Math.max( 0, ind - 1 ) );
      }
    }
    return false;
  }
  
  /**
   * decreases the index and invoke timeout
   */
  var decrease = function()
  {
    setByIndex( Math.max( 0, ind - 1 ) );
    timer = window.setTimeout( decrease, 100 );
    return;
  }
  
  /**
   * mouse down on the top bar, so move up, setting a timer
   */
  var barTopMouseDown = function( e )
  {
    if ( timer ) window.clearTimeout( timer );
    
    ui.registerEvent( "onmouseup", barMouseUp );
    ui.setCursor( "auto" );
    ui.catchEvents();
    ui.onmousedown( e );
    
    decrease();
    return false;
  }
  
  /**
   * increases the index and invoke timeout
   */
  var increase = function()
  {
    setByIndex( Math.min( values.length - 1, ind + 1 ) );
    timer = window.setTimeout( increase, 100 );
    return;
  }
  
  /**
   * mouse down on the top bar, so move up, setting a timer
   */
  var barBottomMouseDown = function( e )
  {
    if ( timer ) window.clearTimeout( timer );
    
    ui.registerEvent( "onmouseup", barMouseUp );
    ui.setCursor( "auto" );
    ui.catchEvents();
    ui.onmousedown( e );
    
    increase();
    return false;
  }
  
  /**
   * move the slider from outside
   */
  this.move = function( i )
  {
    setByIndex( Math.max( 0, Math.min( values.length - 1, ind + i ) ) );
  }
  
  /**
   * mouse up on the top  or bottom bar, so clear the timer
   */
  var barMouseUp = function( e )
  {
    if ( timer ) window.clearTimeout( timer );
    
    ui.releaseEvents()
    ui.removeEvent( "onmouseup", barMouseUp );
    
    return false;
  }
  
  /**
  * resize the slider
  */
  this.resize = function( newSize )
  {
    viewSize = Math.max( handleSize * 2, newSize - viewTop - viewBottom );
    switch ( type )
    {
    case SLIDER_VERTICAL:
      view.style.height = viewSize + "px";
      break;
    case SLIDER_HORIZONTAL:
      view.style.width = viewSize + "px";
      break;
    }
    barSize = viewSize - handleSize - handleTop - handleBottom;
    
    // update the handle position
    setByIndex( ind, true );
    return;
  }
  
  this.update = function(
    min,				//!< the minimal value
    max,				//!< the maximal value
    steps,				//!< number of steps or an array of values
    def,				//!< default value
    onchange,			//!< method to call
    split              //!< split value
  )
  {
    this.onchange = onchange;
    if ( ( typeof steps ) == "number" )
    {
      values = new Array();
      if ( steps > 1 )
        var s = ( max - min ) / ( steps - 1 );
      else
        var s = 0;
      for ( var i = 0; i < steps; ++i )
        values [ i ] = i * s + min;
    }
    else if ( ( typeof steps ) == "object" )
    {
      values = steps;
      min = steps[ 0 ];
      max = steps[ steps.length - 1 ];
    }

    // was a split parameter passed?
    if (split === undefined)
    {
      // disable splitting
      splitIndex = values.length;
    }
    else
    {
      // set split index
      splitIndex = isValue( split );
      if (splitIndex == -1)
      {
          // disable splitting
          splitIndex = values.length;
      }
    }
    
    if ( ( typeof def ) != "undefined" )
    {
      self.setByValue( def, true );
    }
    else
    {
      self.setByValue( values[ 0 ], true );
    }
    
    return;
  }
  
  // initialise
  
  var self = this;
  if ( type != SLIDER_HORIZONTAL ) type = SLIDER_VERTICAL;
  var inputView;
  var timer;
  
  var virtualHandlePos = 0;
  var handlePos = 0;
  
  var values;
  var ind = 0;  //!< the current index
  this.val;     //!< the current value
  var splitIndex = 0; //!< index where to change div class

  if ( !ui ) ui = new UI();
  
  var view = document.createElement( "div" );
  var barTop = document.createElement( "div" );
  var barBottom = document.createElement( "div" );
  var handle = document.createElement( "div" );
  
  handle.onmousedown = handleMouseDown;
  barTop.onmousedown = barTopMouseDown;
  barBottom.onmousedown = barBottomMouseDown;
  
  switch ( type )
  {
  case SLIDER_VERTICAL:
    var viewSize = parseInt( getPropertyFromCssRules( 2, 0, "height" ) );
    var viewTop = parseInt( getPropertyFromCssRules( 2, 0, "marginTop" ) );
    var viewBottom = parseInt( getPropertyFromCssRules( 2, 0, "marginBottom" ) );
    var handleSize = parseInt( getPropertyFromCssRules( 2, 1, "height" ) );
    var handleTop = parseInt( getPropertyFromCssRules( 2, 1, "marginTop" ) );
    var handleBottom = parseInt( getPropertyFromCssRules( 2, 1, "marginBottom" ) );
    var barSize = viewSize - handleSize - handleTop - handleBottom;
    
    // margins are used for the realignment only, so remove it
    view.style.marginTop = view.style.marginBottom = "0px";
    handle.style.marginTop = handle.style.marginBottom = "0px";
    
    view.className = "vSliderView";
    barTop.className = "vSliderBarTop";
    barBottom.className = "vSliderBarBottom";
    handle.className = "vSliderHandle";
    
    break;
  case SLIDER_HORIZONTAL:
    var viewSize = parseInt( getPropertyFromCssRules( 2, 2, "width" ) );
    var viewTop = parseInt( getPropertyFromCssRules( 2, 2, "marginLeft" ) );
    var viewBottom = parseInt( getPropertyFromCssRules( 2, 2, "marginRight" ) );
    var handleSize = parseInt( getPropertyFromCssRules( 2, 3, "width" ) );
    var handleTop = parseInt( getPropertyFromCssRules( 2, 3, "marginLeft" ) );
    var handleBottom = parseInt( getPropertyFromCssRules( 2, 3, "marginRight" ) );
    var barSize = viewSize - handleSize - handleTop - handleBottom;
    
    // margins are used for the realignment only, so remove it
    view.style.marginLeft = view.style.marginRight = "0px";
    handle.style.marginLeft = handle.style.marginRight = "0px";
    
    view.className = "hSliderView";
    barTop.className = "hSliderBarTop";
    barBottom.className = "hSliderBarBottom";
    handle.className = "hSliderHandle";
    break;
  }
  
  view.appendChild( barTop );
  view.appendChild( handle );
  view.appendChild( barBottom );
  
  if ( input )
  {
    var name = uniqueId();
    
    inputView = document.createElement( "p" );
    inputView.style.paddingLeft = "2em";
    input = document.createElement( "input" );
    input.type = "text";
    input.size = "3";
    input.id = input.name = name;
    
    var map = document.createElement( "map" );
    map.id = map.name = "map_" + name;
    var area1 = document.createElement( "area" );
    area1.shape = "rect";
    area1.coords = "0,0,13,9";
    area1.alt = "+";
    var area2 = document.createElement( "area" );
    area2.shape = "rect";
    area2.coords = "0,10,13,18";
    area2.alt = "-";
    
    switch ( type )
    {
    case SLIDER_HORIZONTAL:
      area1.onmousedown = barBottomMouseDown;
      area2.onmousedown = barTopMouseDown;
      break;
    case SLIDER_VERTICAL:
      area1.onmousedown = barTopMouseDown;
      area2.onmousedown = barBottomMouseDown;
      break;
    }
    area1.onmouseup = barMouseUp;
    area2.onmouseup = barMouseUp;
    
    map.appendChild( area1 );
    map.appendChild( area2 );
    
    var img = document.createElement( "img" );
    img.src = STATIC_URL_JS + "widgets/themes/kde/input_topdown.svg";
    img.setAttribute('onerror', 'this.src="' + STATIC_URL_JS + 'widgets/themes/kde/input_topdown.gif";');
    img.alt = "";
    img.useMap = "#map_" + name;
    
    inputView.appendChild( map );
    inputView.appendChild( input );
    inputView.appendChild( img );
    
    inputView.style.display = "none";
    inputView.style.display = "block";
    
    input.onchange = setByInput;
    try
    {
      input.addEventListener( "DOMMouseScroll", mouseWheel, false );
      /* Webkit takes the event but does not understand it ... */
      input.addEventListener( "mousewheel", mouseWheel, false );
    }
    catch ( error )
    {
      try
      {
        input.onmousewheel = mouseWheel;
      }
      catch ( error ) {}
    }
  }
  
  try
  {
    view.addEventListener( "DOMMouseScroll", mouseWheel, false );
    /* Webkit takes the event but does not understand it ... */
    view.addEventListener( "mousewheel", mouseWheel, false );
  }
  catch ( error )
  {
    try
    {
      view.onmousewheel = mouseWheel;
    }
    catch ( error ) {}
  }
  
  this.update( min, max, steps, def, onchange, split);
}
