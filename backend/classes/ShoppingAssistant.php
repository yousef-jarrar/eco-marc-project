<?php
require_once __DIR__.'/CustomerChat.php';
require_once __DIR__.'/ShoppingData.php';

class ShoppingAssistant {
    private PDO $db;
    private ShoppingData $store;
    public function __construct(PDO $db,?ShoppingData $store=null){$this->db=$db;$this->store=$store??new ShoppingData($db);}

    public function answer(string $message,array $history,array $options):array{
        $started=microtime(true);$arabic=preg_match('/\p{Arabic}/u',$message)===1;
        $catalog=$this->store->catalog();
        $action=$options['action']??'message';
        if(!in_array($action,['message','compare','visual'],true))throw new InvalidArgumentException('Invalid shopping action.');
        $text=$this->normalize($message);
        $base=new CustomerChat($this->db,$this->store);
        $outside=preg_match('/طقس|عاصم[ةه]|رئيس|سياسي|انتخابات|كرة قدم|اكتب.*كود|بايثون|جافاسكربت|معادل[ةه]|تشخيص|علاج|دواء|نكت[ةه]|weather|capital of|president|politic|football|write.*code|python|javascript|equation|diagnos|joke/iu',$text);
        if($outside)return $base->answer($message,$history)+['visual_context'=>null];
        if(preg_match('/احفظ.*مقاس|تذكر.*مقاس|تفضيلات|remember.*size|save.*size|shopping preferences/iu',$text)){
            return $this->reply($arabic?'ما بقدر أحفظ تفضيلات دائمة. اذكر مقاسك وميزانيتك في المحادثة وبساعدك حسب طلبك الحالي.':'I cannot save permanent shopping preferences. Tell me your size and budget in this conversation and I can help with your current request.',[])+['visual_context'=>null];
        }
        $ids=$this->ids($options['product_ids']??[],2);
        if($action==='message'&&preg_match('/قارن|الفرق|compare|difference/iu',$text)){
            foreach($catalog as $p)if(mb_stripos($text,$this->normalize($p['name']))!==false)$ids[]=$p['id'];
            $ids=array_values(array_unique($ids));
        }
        if($action==='compare'||count($ids)===2){
            if(count($ids)!==2)throw new InvalidArgumentException('Choose exactly two different products to compare.');
            $products=$this->selected($catalog,$ids,false);
            if(count($products)!==2)throw new InvalidArgumentException('One of these products is no longer available in the catalog.');
            $difference=number_format(abs($products[0]['price']-$products[1]['price']),2).' JOD';
            $answer=$this->reply($arabic?"هاي مقارنة حسب معلومات المتجر. فرق السعر {$difference}. اقرأ التقييم مع عدد التقييمات لكل منتج.":"Here is a comparison using store information. The price difference is {$difference}. Read each rating alongside its review count.",[]);
            $answer['comparison']=$products;
        }elseif($action==='visual'){
            $answer=$this->visual($catalog,$this->ids($options['visual_ids']??[],5),$message,true,$arabic,null);
        }elseif(preg_match('/طقم|اطلال[ةه].*(?:ميزاني|دينار|بحدود)|build.*outfit|complete outfit|outfit.*budget/iu',$text)){
            $answer=$this->outfit($catalog,$message,$history,$arabic);
        }else{
            $visual=$this->ids($options['visual_ids']??[],5);
            if($visual&&preg_match('/ارخص|نفس النوع|نفس القطع|نفس الصوره|اسود|ابيض|احمر|ازرق|بيج|مقاس|لون|cheaper|same type|same style|black|white|red|blue|beige|size|color/iu',$text)&&!preg_match('/بدي حذاء|بدي ملابس|show.*shirts|new search|بحث جديد/iu',$text)){
                $anchor=$options['visual_anchor_id']??null;
                if($anchor!==null&&(!is_int($anchor)||!in_array($anchor,$visual,true)))throw new InvalidArgumentException('Invalid visual search reference.');
                $answer=$this->visual($catalog,$visual,$message,false,$arabic,$anchor);
            }else{
                $answer=$base->answer($message,$history);
                $answer['visual_context']=null;
            }
        }
        foreach($answer['products'] as &$product)$product['recommendation_reasons']=$this->reasons($product,$message,$arabic,isset($answer['visual_context'])&&$answer['visual_context']!==null);
        unset($product);
        if(!array_key_exists('visual_context',$answer))$answer['visual_context']=null;
        $answer['processing_ms']=(int)round((microtime(true)-$started)*1000);
        return $answer;
    }

    private function normalize(string $message):string{
        return str_replace(['أ','إ','آ','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'],['ا','ا','ا','0','1','2','3','4','5','6','7','8','9'],mb_strtolower(preg_replace('/[\x{064B}-\x{065F}\x{0640}]/u','',$message)));
    }
    private function reply(string $text,array $products):array{return ['reply'=>$text,'products'=>$products,'links'=>[],'mode'=>'catalog'];}
    private function ids($value,int $limit):array{
        if(!is_array($value)||count($value)>$limit)throw new InvalidArgumentException('Too many selected products.');
        foreach($value as $id)if(!is_int($id)||$id<1)throw new InvalidArgumentException('Invalid product selection.');
        return array_values(array_unique($value));
    }
    private function selected(array $catalog,array $ids,bool $available=true):array{
        $byId=array_column($catalog,null,'id');$products=[];
        foreach($ids as $id)if(isset($byId[$id])&&(!$available||$byId[$id]['variants']))$products[]=$byId[$id];
        return $products;
    }
    private function budget(string $text):?float{
        if(preg_match('/(?:under|below|budget|تحت|اقل من|بحدود|ميزانيتي|ميزانيه|ميزانية|بميزاني[ةه])\s*(\d+(?:\.\d+)?)/iu',$this->normalize($text),$match))return (float)$match[1];
        if(preg_match('/(\d+(?:\.\d+)?)\s*(?:دينار|jod)/iu',$this->normalize($text),$match))return (float)$match[1];
        return null;
    }
    private function requestedVariant(string $text):array{
        $text=$this->normalize($text);$size='';$color='';
        if(preg_match('/(?:مقاس|size)\s*([0-9]{1,2}|xxl|xl|xs|s|m|l)\b/iu',$text,$match))$size=strtoupper($match[1]);
        foreach(['black'=>'اسود|black','white'=>'ابيض|white','red'=>'احمر|red','blue'=>'ازرق|blue','beige'=>'بيج|beige','brown'=>'بني|brown','green'=>'اخضر|green','gray'=>'رمادي|gr[ae]y']as $name=>$pattern)if(preg_match('/'.$pattern.'/iu',$text)){$color=$name;break;}
        return [$size,$color];
    }
    private function matchesVariant(array $product,string $size,string $color):bool{
        foreach($product['variants']as $v)if(($size===''||strcasecmp($v['size'],$size)===0)&&($color===''||strcasecmp($v['color'],$color)===0))return true;
        return false;
    }
    private function reasons(array $p,string $message,bool $arabic,bool $visual):array{
        $reasons=[];$budget=$this->budget($message);[$size,$color]=$this->requestedVariant($message);
        if($visual)$reasons[]=$arabic?'من نتائج البحث بصورتك':'From your image results';
        if($budget!==null&&$p['price']<=$budget)$reasons[]=$arabic?'ضمن ميزانيتك':'Within your budget';
        if($size!==''&&$this->matchesVariant($p,$size,$color))$reasons[]=$arabic?'المقاس المطلوب متوفر':'Requested size available';
        if($color!==''&&$this->matchesVariant($p,$size,$color))$reasons[]=$arabic?'اللون المطلوب متوفر':'Requested color available';
        if($p['review_count']>0)$reasons[]=($arabic?'تقييم معتمد ':'Approved rating ').number_format($p['average_rating'],2).'/5';
        if($p['price']<$p['original_price'])$reasons[]=$arabic?'خصم مسجل على المنتج':'Current recorded discount';
        if(!$reasons&&$p['variants'])$reasons[]=$arabic?'متوفر حالياً بالمقاسات المعروضة':'Available in the listed variants';
        return array_slice($reasons,0,3);
    }
    private function visual(array $catalog,array $ids,string $message,bool $initial,bool $arabic,?int $anchor):array{
        if(!$ids)return $this->reply($arabic?'ما لقيت نتائج للصورة. جرّب صورة واضحة لقطعة واحدة.':'No image matches were found. Try a clear photo of one item.',[])+['visual_context'=>null];
        $products=$this->selected($catalog,$ids);$first=$products[0]??null;
        if(!$first)return $this->reply($arabic?'المنتجات اللي بالصورة مش متوفرة حالياً. جرّب صورة ثانية.':'Those image matches are no longer available. Try another photo.',[])+['visual_context'=>null];
        $category=$first['category_id'];[$size,$color]=$this->requestedVariant($message);$budget=$this->budget($message);
        $cheaper=!$initial&&preg_match('/ارخص|cheaper/iu',$this->normalize($message));
        $reference=$this->selected($catalog,[$anchor??$first['id']]);$price=$reference[0]['price']??$first['price'];
        $products=array_values(array_filter($products,function($p)use($category,$size,$color,$budget,$cheaper,$price){return $p['category_id']===$category&&$this->matchesVariant($p,$size,$color)&&($budget===null||$p['price']<=$budget)&&(!$cheaper||$p['price']<$price);}));
        if($cheaper)usort($products,function($a,$b){return $a['price']<=>$b['price'];});
        $text=$products?($arabic?($initial?'هاي أقرب قطع متوفرة من نتائج صورتك. بتقدر تطلب لون، مقاس أو خيارات أرخص.':'هاي النتائج من نفس بحث الصورة بعد تطبيق طلبك، بدون تغيير التصنيف.'):($initial?'Here are available matches from your photo. Ask for a color, size or cheaper options.':'These pieces are from the same image search, refined without changing category.')):($arabic?'ما في نتائج من نفس بحث الصورة بتطابق هالشروط. غيّر اللون أو المقاس أو جرّب صورة ثانية.':'No pieces from that image search match these filters. Try another color, size or photo.');
        return $this->reply($text,$products)+['visual_context'=>['ids'=>$ids,'anchor_id'=>$products[0]['id']??$first['id']]];
    }
    private function outfit(array $catalog,string $message,array $history,bool $arabic):array{
        $budget=$this->budget($message);
        if($budget===null)foreach(array_reverse($history)as $row)if($row['role']==='user'&&($budget=$this->budget($row['content']))!==null)break;
        if($budget===null)return $this->reply($arabic?'أكيد! قديش ميزانيتك للطقم كامل؟ مثلاً «طقم تحت 150 دينار». اذكر المقاس كمان إذا بتحب.':'What is your budget for the whole outfit? Try “a complete outfit under 150 JOD”. You can include the sizes you need.',[]);
        $groups=['top'=>[],'bottom'=>[],'footwear'=>[]];
        foreach($catalog as $p){
            $slot=preg_match('/^tops?$|shirts|بلوز|قمصان/iu',$p['category'])?'top':(preg_match('/bottom|trouser|pant|بناطيل/iu',$p['category'])?'bottom':(preg_match('/footwear|shoe|احذي/iu',$p['category'])?'footwear':null));
            if($slot===null||!$p['variants'])continue;
            $size='';
            if($slot==='footwear'&&preg_match('/(?:حذاء|مقاس|shoe|size)\s*(?:مقاس\s*|size\s*)?([0-9]{2})\b/iu',$this->normalize($message),$match))$size=$match[1];
            if($slot!=='footwear'&&preg_match('/(?:مقاس|size)\s*(xxl|xl|xs|s|m|l)\b/iu',$message,$match))$size=strtoupper($match[1]);
            if(!$this->matchesVariant($p,$size,''))continue;
            $gender=preg_match('/رجالي|للرجال|\bmen\b/iu',$message)?'men':(preg_match('/نسائي|للنساء|\bwomen\b/iu',$message)?'women':'');
            if($gender!==''&&!empty($p['metadata']['gender'])&&!in_array($p['metadata']['gender'],[$gender,'unisex'],true))continue;
            $groups[$slot][]=$p;
        }
        $best=[];$bestCents=0;$budgetCents=(int)round($budget*100);
        foreach($groups as $slot=>$items){
            if(!$items){
                $labels=['top'=>['قطعة علوية','a top'],'bottom'=>['بنطلون','bottoms'],'footwear'=>['حذاء','footwear']];
                return $this->reply($arabic?'ما في '.$labels[$slot][0].' متوفر ضمن المقاسات والستايل المطلوبين، فما بقدر أركّب طقم كامل حالياً. بقدر أساعدك تختار قطعة منفردة أو تغيّر المقاسات.':'There is no available '.$labels[$slot][1].' under the requested size and style constraints, so I cannot build a complete outfit right now. I can help choose individual pieces or different sizes.',[]);
            }
            usort($items,function($a,$b){return ($a['price']<=>$b['price'])?:($a['id']<=>$b['id']);});
            $best[]=$items[0];$bestCents+=(int)round($items[0]['price']*100);
        }
        if($bestCents>$budgetCents)$best=null;
        if(!$best)return $this->reply($arabic?'ما قدرت أركّب طقم كامل من قطعة علوية وبنطلون وحذاء ضمن الميزانية والمقاسات المتاحة. ما رح أزيد الميزانية أو أضيف قطعة غير متوفرة؛ بتحب تغيّر الميزانية أو المقاس؟':'I could not build a complete top, bottoms and footwear outfit within the budget and available sizes. I will not exceed your budget or include unavailable pieces. Would you like to change the budget or size?',[]);
        $total=number_format($bestCents/100,2).' JOD';$remaining=round($budget-$bestCents/100,2);
        $answer=$this->reply($arabic?"هاي تركيبة كاملة من القطع المتوفرة بأقل مجموع ضمن شروطك: {$total}، بدون رسوم التوصيل. تأكد من الصور والقصّات؛ توافق الستايل اقتراح مش ضمان.":"Here is a complete combination using available pieces at the lowest total under your constraints: {$total}, excluding delivery. Check the photos and cuts; styling is a suggestion, not a guarantee.",$best);
        $answer['outfit']=['total'=>$bestCents/100,'budget'=>$budget,'remaining'=>$remaining,'slots'=>['top','bottom','footwear']];
        return $answer;
    }
}
