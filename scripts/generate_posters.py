import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('assets', exist_ok=True)

# Helper function to get a font or fallback
def get_font(size, bold=False):
    font_names = [
        "arialbd.ttf" if bold else "arial.ttf",
        "seguisb.ttf" if bold else "segoeui.ttf",
        "calibrib.ttf" if bold else "calibri.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    ]
    for fn in font_names:
        try:
            return ImageFont.truetype(fn, size)
        except Exception:
            continue
    return ImageFont.load_default()

def draw_header(draw, title, subtitle, bg_color=(30, 92, 64)):
    draw.rectangle([0, 0, 800, 140], fill=bg_color)
    f_title = get_font(38, bold=True)
    f_sub = get_font(18, bold=False)
    draw.text((400, 50), title, font=f_title, fill=(255, 255, 255), anchor="mm")
    draw.text((400, 100), subtitle, font=f_sub, fill=(230, 240, 235), anchor="mm")

def draw_badge(draw, bbox, text, bg=(192, 61, 50), fg=(255, 255, 255)):
    draw.rounded_rectangle(bbox, radius=12, fill=bg)
    f = get_font(20, bold=True)
    cx = (bbox[0] + bbox[2]) // 2
    cy = (bbox[1] + bbox[3]) // 2
    draw.text((cx, cy), text, font=f, fill=fg, anchor="mm")

# 1. Poster 1: Arka Diwali Delight
def create_poster_1():
    img = Image.new('RGB', (800, 1000), color=(252, 249, 240))
    d = ImageDraw.Draw(img)
    draw_header(d, "ARKA FOODS", "TRADITIONAL MITHAI & FESTIVE CELEBRATIONS", (30, 92, 64))
    
    # Hero card
    d.rounded_rectangle([60, 180, 740, 500], radius=18, fill=(245, 238, 220), outline=(215, 200, 175), width=2)
    f_hero = get_font(44, bold=True)
    d.text((400, 270), "India's No. 1", font=f_hero, fill=(180, 40, 30), anchor="mm")
    f_hero2 = get_font(34, bold=True)
    d.text((400, 340), "Festive Sweets & Mithai", font=f_hero2, fill=(40, 50, 42), anchor="mm")
    f_p = get_font(20, bold=False)
    d.text((400, 410), "Handcrafted with pure desi ghee and love", font=f_p, fill=(80, 90, 80), anchor="mm")
    
    # Badges
    draw_badge(d, [90, 540, 380, 620], "100% Pure Desi Ghee", bg=(40, 90, 60))
    draw_badge(d, [420, 540, 710, 620], "Guaranteed Delivery", bg=(180, 40, 30))
    
    # Product grid simulation
    d.rounded_rectangle([60, 660, 740, 840], radius=14, fill=(255, 255, 255), outline=(230, 225, 210), width=1)
    f_b = get_font(22, bold=True)
    d.text((400, 710), "Six Classic Mithai Assortments", font=f_b, fill=(30, 40, 32), anchor="mm")
    f_note = get_font(18, bold=False)
    d.text((400, 760), "Kaju Katli | Besan Ladoo | Peda | Motichoor", font=f_note, fill=(100, 110, 100), anchor="mm")
    
    # Footer
    d.rectangle([0, 920, 800, 1000], fill=(24, 40, 30))
    f_foot = get_font(18, bold=True)
    d.text((400, 960), "Order Before 18 October for Guaranteed Delivery", font=f_foot, fill=(255, 255, 255), anchor="mm")
    
    img.save('assets/arka-diwali-delight.png')
    print("Created assets/arka-diwali-delight.png")

# 2. Poster 2: Arka Namkeen Fest
def create_poster_2():
    img = Image.new('RGB', (800, 1000), color=(255, 252, 245))
    d = ImageDraw.Draw(img)
    draw_header(d, "ARKA CRUNCH", "GUJARAT'S FAVOURITE ROASTED SNACKS", (180, 83, 9))
    
    # Main Headline
    d.rounded_rectangle([60, 170, 740, 480], radius=16, fill=(254, 243, 199), outline=(245, 158, 11), width=2)
    f_main = get_font(42, bold=True)
    d.text((400, 250), "The Best Tasting", font=f_main, fill=(180, 40, 30), anchor="mm")
    d.text((400, 320), "Roasted Namkeen in India", font=f_main, fill=(35, 45, 38), anchor="mm")
    
    f_hype = get_font(24, bold=True)
    d.text((400, 400), "Insanely Crunchy & Crazy Good", font=f_hype, fill=(180, 83, 9), anchor="mm")
    
    # Offer section
    d.rounded_rectangle([60, 510, 740, 680], radius=16, fill=(254, 226, 226), outline=(239, 68, 68), width=2)
    f_off = get_font(36, bold=True)
    d.text((400, 570), "Buy 1 Get 1 Free Gift", font=f_off, fill=(185, 28, 28), anchor="mm")
    f_suboff = get_font(20, bold=False)
    d.text((400, 630), "100% Free Gift on Every Single Order", font=f_suboff, fill=(127, 29, 29), anchor="mm")
    
    # Quality points
    draw_badge(d, [90, 720, 380, 800], "Zero Trans Fat", bg=(40, 90, 60))
    draw_badge(d, [420, 720, 710, 800], "100% Roasted", bg=(180, 83, 9))
    
    # Footer
    d.rectangle([0, 920, 800, 1000], fill=(45, 30, 20))
    f_foot = get_font(18, bold=True)
    d.text((400, 960), "Order Online Today at ArkaFoods.com", font=f_foot, fill=(255, 255, 255), anchor="mm")
    
    img.save('assets/arka-namkeen-fest.png')
    print("Created assets/arka-namkeen-fest.png")

# 3. Poster 3: NovaTech Cloud Launch
def create_poster_3():
    img = Image.new('RGB', (800, 1000), color=(248, 250, 252))
    d = ImageDraw.Draw(img)
    draw_header(d, "NOVATECH ENTERPRISE", "SECURE NEXT-GEN CLOUD INFRASTRUCTURE", (30, 58, 138))
    
    # Claim Box
    d.rounded_rectangle([60, 180, 740, 480], radius=16, fill=(238, 242, 255), outline=(199, 210, 254), width=2)
    f_head = get_font(36, bold=True)
    d.text((400, 260), "The World's Most Trusted", font=f_head, fill=(180, 40, 30), anchor="mm")
    d.text((400, 330), "Enterprise Cloud Platform", font=f_head, fill=(30, 41, 59), anchor="mm")
    f_tech = get_font(22, bold=False)
    d.text((400, 410), "AI-orchestrated data processing at microsecond latency", font=f_tech, fill=(71, 85, 105), anchor="mm")
    
    # Guarantees Box
    d.rounded_rectangle([60, 510, 740, 680], radius=16, fill=(254, 242, 242), outline=(252, 165, 165), width=2)
    f_sla = get_font(32, bold=True)
    d.text((400, 570), "Zero Downtime Guaranteed 100%", font=f_sla, fill=(185, 28, 28), anchor="mm")
    f_cheap = get_font(22, bold=True)
    d.text((400, 630), "Cheapest Cloud Storage in Asia", font=f_cheap, fill=(153, 27, 27), anchor="mm")
    
    # Features
    draw_badge(d, [90, 720, 380, 800], "SOC2 Certified", bg=(30, 58, 138))
    draw_badge(d, [420, 720, 710, 800], "99.999% High SLA", bg=(15, 118, 110))
    
    # Footer
    d.rectangle([0, 920, 800, 1000], fill=(15, 23, 42))
    f_foot = get_font(18, bold=True)
    d.text((400, 960), "Start Your 30-Day Free Pilot Today | NovaTech.io", font=f_foot, fill=(255, 255, 255), anchor="mm")
    
    img.save('assets/novatech-cloud-launch.png')
    print("Created assets/novatech-cloud-launch.png")

# 4. Poster 4: FreshBites Organic Promo
def create_poster_4():
    img = Image.new('RGB', (800, 1000), color=(247, 254, 231))
    d = ImageDraw.Draw(img)
    draw_header(d, "FRESHBITES ORGANIC", "100% COLD-PRESSED JUICES & SUPERFOODS", (77, 124, 15))
    
    # Health claims box
    d.rounded_rectangle([60, 180, 740, 480], radius=16, fill=(236, 252, 203), outline=(163, 230, 53), width=2)
    f_title = get_font(38, bold=True)
    d.text((400, 250), "Certified #1 Organic Brand", font=f_title, fill=(180, 40, 30), anchor="mm")
    f_med = get_font(30, bold=True)
    d.text((400, 330), "100% Cure For Daily Fatigue", font=f_med, fill=(185, 28, 28), anchor="mm")
    f_desc = get_font(20, bold=False)
    d.text((400, 410), "Permanently boosts immunity and rejuvenates body cells", font=f_desc, fill=(54, 83, 20), anchor="mm")
    
    # Promotional card
    d.rounded_rectangle([60, 510, 740, 680], radius=16, fill=(254, 243, 199), outline=(251, 191, 36), width=2)
    f_promo = get_font(30, bold=True)
    d.text((400, 570), "Free Gift on Every Delivery", font=f_promo, fill=(180, 83, 9), anchor="mm")
    f_vegan = get_font(22, bold=False)
    d.text((400, 630), "100% vegan-friendly farm fresh extracts", font=f_vegan, fill=(120, 53, 15), anchor="mm")
    
    # Badges
    draw_badge(d, [90, 720, 380, 800], "Cold-Pressed Raw", bg=(77, 124, 15))
    draw_badge(d, [420, 720, 710, 800], "Zero Added Sugar", bg=(40, 90, 60))
    
    # Footer
    d.rectangle([0, 920, 800, 1000], fill=(26, 46, 5))
    f_foot = get_font(18, bold=True)
    d.text((400, 960), "Fresh Morning Delivery to 40+ Cities | FreshBites.in", font=f_foot, fill=(255, 255, 255), anchor="mm")
    
    img.save('assets/freshbites-organic-promo.png')
    print("Created assets/freshbites-organic-promo.png")

# 5. Poster 5: Arka Gold Gifting
def create_poster_5():
    img = Image.new('RGB', (800, 1000), color=(254, 252, 232))
    d = ImageDraw.Draw(img)
    draw_header(d, "ARKA ROYAL COLLECTION", "HERITAGE DRY FRUITS & ARTISANAL MITHAI", (133, 77, 14))
    
    # Royal Box
    d.rounded_rectangle([60, 180, 740, 480], radius=16, fill=(254, 240, 138), outline=(202, 138, 4), width=2)
    f_roy = get_font(38, bold=True)
    d.text((400, 250), "Sabse Bada Festive Celebration", font=f_roy, fill=(180, 40, 30), anchor="mm")
    f_subroy = get_font(32, bold=True)
    d.text((400, 330), "Royal Gold Gift Hamper", font=f_subroy, fill=(66, 32, 6), anchor="mm")
    f_desc = get_font(20, bold=False)
    d.text((400, 410), "Handcrafted almond, pistachio and saffron treats", font=f_desc, fill=(113, 63, 18), anchor="mm")
    
    # Money back guarantee
    d.rounded_rectangle([60, 510, 740, 680], radius=16, fill=(254, 226, 226), outline=(248, 113, 113), width=2)
    f_guar = get_font(30, bold=True)
    d.text((400, 570), "100% Money Back Guaranteed", font=f_guar, fill=(185, 28, 28), anchor="mm")
    f_del = get_font(20, bold=False)
    d.text((400, 630), "Guaranteed delivery across all state pin codes", font=f_del, fill=(153, 27, 27), anchor="mm")
    
    # Badges
    draw_badge(d, [90, 720, 380, 800], "24K Edible Gold Foil", bg=(161, 98, 7))
    draw_badge(d, [420, 720, 710, 800], "Custom Luxury Box", bg=(40, 90, 60))
    
    # Footer
    d.rectangle([0, 920, 800, 1000], fill=(69, 26, 3))
    f_foot = get_font(18, bold=True)
    d.text((400, 960), "Exclusive Festive Pre-Orders Open Now", font=f_foot, fill=(255, 255, 255), anchor="mm")
    
    img.save('assets/arka-gold-gifting.png')
    print("Created assets/arka-gold-gifting.png")

if __name__ == '__main__':
    create_poster_1()
    create_poster_2()
    create_poster_3()
    create_poster_4()
    create_poster_5()
